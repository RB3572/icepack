/**
 * Sequence design.
 *
 * Design variables live on domains; a strand is an ordered list of domains,
 * optionally complemented (a name ending in "*"). Every base pair in a target
 * structure couples two design positions, so positions are merged into
 * components with a parity flag: members of a component are either identical to
 * the representative or complementary to it. Mutating a component therefore
 * keeps every target structure sequence-compatible by construction.
 *
 * The objective is the multi-tube ensemble defect of Wolfe & Pierce, which
 * combines a structural term (how far each on-target complex's equilibrium
 * ensemble is from its target structure) with a concentration term (how much
 * material is lost to off-target complexes).
 */
import {
  BASE_A,
  BASE_C,
  BASE_G,
  BASE_U,
  complement,
  decodeSequence,
  expandCode,
  type Material,
} from "./alphabet";
import { Model, type ModelSpec, makeNickedSequence } from "./model";
import { partitionFunction } from "./pf";
import { mfe } from "./mfe";
import { ensembleDefect, mfeDefect } from "./defect";
import { parseStructure } from "./structure";
import { type StrandSpecies, analyzeComplex, makeComplexId } from "./complex";
import { tubeComplexes, type TubeSpec } from "./analysis";
import { solveConcentrations } from "./concentrations";

const BASES = [BASE_A, BASE_C, BASE_G, BASE_U];

export interface DomainSpec {
  name: string;
  /** IUPAC constraint string; length fixes the domain length. */
  constraint: string;
}

export interface DesignStrandSpec {
  name: string;
  /** Domain names in 5'-to-3' order; a trailing "*" means complemented. */
  domains: string[];
}

export interface TargetComplexSpec {
  name: string;
  /** Strand names in order. */
  strands: string[];
  /** Target structure in dot-parens-plus (or any supported notation). */
  structure: string;
}

export interface DesignTubeSpec {
  name: string;
  onTargets: Array<{ complex: string; concentration: number }>;
  maxComplexSize: number;
}

export interface DesignJob {
  model: ModelSpec;
  domains: DomainSpec[];
  strands: DesignStrandSpec[];
  complexes: TargetComplexSpec[];
  tubes: DesignTubeSpec[];
  /** Stop when the normalized defect falls below this. */
  stopCondition: number;
  /** Wall-clock budget in seconds. */
  maxTime: number;
  seed: number;
  trials: number;
}

export interface DesignResult {
  domains: Array<{ name: string; sequence: string }>;
  strands: Array<{ name: string; sequence: string }>;
  defect: number;
  stopConditionMet: boolean;
  mutations: number;
  seconds: number;
  /** Per-complex report at the final sequence. */
  complexes: Array<{
    name: string;
    sequence: string;
    structure: string;
    ensembleDefect: number;
    normalizedDefect: number;
    structureFreeEnergy: number;
    complexFreeEnergy: number;
    probability: number;
    mfeDefect: number;
  }>;
  tubes: Array<{
    name: string;
    defect: number;
    complexes: Array<{ name: string; concentration: number; target: number }>;
  }>;
}

/** Deterministic PRNG so a seed reproduces a design run. */
function makeRandom(seed: number) {
  let state = (seed >>> 0) || 0x2545f491;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

interface Variable {
  domain: number;
  index: number;
}

class ParityUnion {
  private parent: number[];
  private parity: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.parity = new Array(size).fill(0);
  }

  find(x: number): { root: number; parity: number } {
    if (this.parent[x] === x) return { root: x, parity: 0 };
    const up = this.find(this.parent[x]);
    this.parent[x] = up.root;
    this.parity[x] ^= up.parity;
    return { root: up.root, parity: this.parity[x] };
  }

  /** Records that a and b differ by `relation` (0 identical, 1 complementary). */
  union(a: number, b: number, relation: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra.root === rb.root) return ra.parity ^ rb.parity ^ relation ? false : true;
    this.parent[ra.root] = rb.root;
    this.parity[ra.root] = ra.parity ^ rb.parity ^ relation;
    return true;
  }
}

export interface DesignProblem {
  variables: Variable[];
  /** Component id and parity of each variable. */
  component: Int32Array;
  parity: Int8Array;
  /** Allowed bases per component, expressed in representative space. */
  allowed: number[][];
  componentCount: number;
  domainOffsets: number[];
  domainLengths: number[];
  strandVariables: number[][];
  strandComplemented: boolean[][];
  species: StrandSpecies[];
  targets: Array<{ name: string; order: number[]; pairs: Int32Array; strandLengths: number[] }>;
  material: Material;
}

export class DesignError extends Error {}

export function buildDesignProblem(job: DesignJob): DesignProblem {
  const domainIndex = new Map<string, number>();
  job.domains.forEach((domain, index) => domainIndex.set(domain.name, index));

  const domainLengths = job.domains.map((domain) => domain.constraint.length);
  const domainOffsets: number[] = [];
  let total = 0;
  for (const length of domainLengths) {
    domainOffsets.push(total);
    total += length;
  }

  const variables: Variable[] = [];
  job.domains.forEach((domain, index) => {
    for (let k = 0; k < domainLengths[index]; k++) variables.push({ domain: index, index: k });
  });

  // Map every strand position to a variable, tracking complementation.
  const strandVariables: number[][] = [];
  const strandComplemented: boolean[][] = [];
  const strandIndex = new Map<string, number>();
  job.strands.forEach((strand, index) => strandIndex.set(strand.name, index));

  for (const strand of job.strands) {
    const vars: number[] = [];
    const flags: boolean[] = [];
    for (const token of strand.domains) {
      const complemented = token.endsWith("*");
      const name = complemented ? token.slice(0, -1) : token;
      const index = domainIndex.get(name);
      if (index === undefined) throw new DesignError(`Unknown domain "${name}"`);
      const length = domainLengths[index];
      for (let k = 0; k < length; k++) {
        // A complemented domain reads its own bases 3'-to-5' and complemented.
        const position = complemented ? length - 1 - k : k;
        vars.push(domainOffsets[index] + position);
        flags.push(complemented);
      }
    }
    strandVariables.push(vars);
    strandComplemented.push(flags);
  }

  const union = new ParityUnion(total);
  const targets: DesignProblem["targets"] = [];

  for (const target of job.complexes) {
    const order = target.strands.map((name) => {
      const index = strandIndex.get(name);
      if (index === undefined) throw new DesignError(`Unknown strand "${name}"`);
      return index;
    });
    const parsed = parseStructure(target.structure);
    const expected = order.reduce((sum, index) => sum + strandVariables[index].length, 0);
    if (parsed.n !== expected) {
      throw new DesignError(
        `Target "${target.name}": structure has ${parsed.n} nucleotides but the strands have ${expected}`,
      );
    }
    const flatVariables: number[] = [];
    const flatFlags: boolean[] = [];
    const strandLengths: number[] = [];
    for (const index of order) {
      flatVariables.push(...strandVariables[index]);
      flatFlags.push(...strandComplemented[index]);
      strandLengths.push(strandVariables[index].length);
    }
    for (let i = 0; i < parsed.n; i++) {
      const j = parsed.pairs[i];
      if (j <= i) continue;
      // complementary when both positions carry the same complementation flag
      const relation = flatFlags[i] === flatFlags[j] ? 1 : 0;
      if (!union.union(flatVariables[i], flatVariables[j], relation)) {
        throw new DesignError(
          `Target "${target.name}" imposes contradictory pairing on the domains`,
        );
      }
    }
    targets.push({ name: target.name, order, pairs: parsed.pairs, strandLengths });
  }

  const component = new Int32Array(total);
  const parity = new Int8Array(total);
  const roots = new Map<number, number>();
  for (let v = 0; v < total; v++) {
    const found = union.find(v);
    let id = roots.get(found.root);
    if (id === undefined) {
      id = roots.size;
      roots.set(found.root, id);
    }
    component[v] = id;
    parity[v] = found.parity;
  }
  const componentCount = roots.size;

  const allowed: number[][] = Array.from({ length: componentCount }, () => [...BASES]);
  job.domains.forEach((domain, index) => {
    for (let k = 0; k < domainLengths[index]; k++) {
      const v = domainOffsets[index] + k;
      const letter = domain.constraint[k] ?? "N";
      const options = expandCode(letter);
      if (!options) throw new DesignError(`Unknown constraint code "${letter}"`);
      const mapped = parity[v] === 1 ? options.map((base) => complement(base)) : options;
      const id = component[v];
      allowed[id] = allowed[id].filter((base) => mapped.includes(base));
    }
  });
  allowed.forEach((options, id) => {
    if (options.length === 0) {
      throw new DesignError(`Sequence constraints cannot be satisfied (component ${id})`);
    }
  });

  const species: StrandSpecies[] = job.strands.map((strand, index) => ({
    name: strand.name,
    sequence: new Array(strandVariables[index].length).fill(BASE_A),
  }));

  return {
    variables,
    component,
    parity,
    allowed,
    componentCount,
    domainOffsets,
    domainLengths,
    strandVariables,
    strandComplemented,
    species,
    targets,
    material: job.model.material,
  };
}

/** Expands component choices into the nucleotide sequence of every variable. */
function materialize(problem: DesignProblem, choice: number[]): Uint8Array {
  const bases = new Uint8Array(problem.component.length);
  for (let v = 0; v < bases.length; v++) {
    const base = choice[problem.component[v]];
    bases[v] = problem.parity[v] === 1 ? complement(base) : base;
  }
  return bases;
}

function strandSequences(problem: DesignProblem, bases: Uint8Array): number[][] {
  return problem.strandVariables.map((vars, strand) =>
    vars.map((v, k) => {
      const value = bases[v];
      return problem.strandComplemented[strand][k] ? complement(value) : value;
    }),
  );
}

export interface ObjectiveContext {
  problem: DesignProblem;
  job: DesignJob;
  model: Model;
}

/** Normalized multi-tube ensemble defect at the given sequences. */
export function evaluateDefect(
  context: ObjectiveContext,
  sequences: number[][],
): { defect: number; detail: DesignResult["tubes"]; perComplex: Map<string, number> } {
  const { problem, job, model } = context;
  const species: StrandSpecies[] = problem.species.map((entry, index) => ({
    name: entry.name,
    sequence: sequences[index],
  }));

  const targetByName = new Map(problem.targets.map((target) => [target.name, target]));
  const perComplex = new Map<string, number>();
  const detail: DesignResult["tubes"] = [];
  let numerator = 0;
  let denominator = 0;

  for (const tube of job.tubes) {
    const concentrations = new Array(species.length).fill(0);
    const targetConcentration = new Map<string, number>();
    for (const onTarget of tube.onTargets) {
      const target = targetByName.get(onTarget.complex);
      if (!target) throw new DesignError(`Unknown target complex "${onTarget.complex}"`);
      targetConcentration.set(onTarget.complex, onTarget.concentration);
      for (const strandIndex of target.order) {
        concentrations[strandIndex] += onTarget.concentration;
      }
    }

    const spec: TubeSpec = {
      name: tube.name,
      concentrations,
      maxComplexSize: tube.maxComplexSize,
      include: tube.onTargets.map((onTarget) => targetByName.get(onTarget.complex)!.order),
    };
    const ids = tubeComplexes(species, spec);
    const analyzed = ids.map((id) => analyzeComplex(species, id, model));
    const usable = analyzed.filter((entry) => Number.isFinite(entry.freeEnergy));
    const solution = solveConcentrations({
      composition: usable.map((entry) => entry.id.counts),
      freeEnergies: usable.map((entry) => entry.freeEnergy),
      totals: concentrations,
      RT: model.RT,
    });

    const concentrationByKey = new Map<string, number>();
    usable.forEach((entry, index) => {
      concentrationByKey.set(entry.id.counts.join(","), solution.concentrations[index]);
    });

    let tubeDefect = 0;
    let tubeNorm = 0;
    const entries: Array<{ name: string; concentration: number; target: number }> = [];

    for (const onTarget of tube.onTargets) {
      const target = targetByName.get(onTarget.complex)!;
      const counts = new Array(species.length).fill(0);
      for (const strandIndex of target.order) counts[strandIndex] += 1;
      const key = counts.join(",");
      const actual = concentrationByKey.get(key) ?? 0;
      const wanted = onTarget.concentration;

      const strands = target.order.map((index) => species[index].sequence);
      const seq = makeNickedSequence(strands);
      const partition = partitionFunction(seq, model, { pairs: true });
      const defect = ensembleDefect(target.pairs, partition);
      perComplex.set(target.name, defect);

      const nt = seq.n;
      tubeDefect += Math.min(actual, wanted) * defect + nt * Math.max(0, wanted - actual);
      tubeNorm += nt * wanted;
      entries.push({ name: target.name, concentration: actual, target: wanted });
    }

    numerator += tubeDefect;
    denominator += tubeNorm;
    detail.push({
      name: tube.name,
      defect: tubeNorm > 0 ? tubeDefect / tubeNorm : 0,
      complexes: entries,
    });
  }

  return {
    defect: denominator > 0 ? numerator / denominator : 0,
    detail,
    perComplex,
  };
}

/** Ensemble defect of one complex, the objective used by the Utilities page. */
export function complexDefectObjective(
  problem: DesignProblem,
  model: Model,
  sequences: number[][],
): number {
  let total = 0;
  let length = 0;
  for (const target of problem.targets) {
    const seq = makeNickedSequence(target.order.map((index) => sequences[index]));
    const partition = partitionFunction(seq, model, { pairs: true });
    total += ensembleDefect(target.pairs, partition);
    length += seq.n;
  }
  return length > 0 ? total / length : 0;
}

/** MFE defect of one complex, the cheaper alternative objective. */
export function complexMfeObjective(
  problem: DesignProblem,
  model: Model,
  sequences: number[][],
): number {
  let total = 0;
  let length = 0;
  for (const target of problem.targets) {
    const seq = makeNickedSequence(target.order.map((index) => sequences[index]));
    const minimum = mfe(seq, model);
    total += mfeDefect(target.pairs, minimum.pairs);
    length += seq.n;
  }
  return length > 0 ? total / length : 0;
}

export type DesignObjective = "multitube" | "ensemble" | "mfe";

export function runDesign(
  job: DesignJob,
  objective: DesignObjective = "multitube",
  onProgress?: (defect: number, mutations: number) => void,
): DesignResult {
  const problem = buildDesignProblem(job);
  const model = new Model(job.model);
  const context: ObjectiveContext = { problem, job, model };
  const random = makeRandom(job.seed);
  const started = Date.now();
  const budget = Math.max(1, job.maxTime) * 1000;

  const score = (choice: number[]): number => {
    const sequences = strandSequences(problem, materialize(problem, choice));
    if (objective === "mfe") return complexMfeObjective(problem, model, sequences);
    if (objective === "ensemble") return complexDefectObjective(problem, model, sequences);
    return evaluateDefect(context, sequences).defect;
  };

  const randomChoice = (): number[] =>
    problem.allowed.map((options) => options[Math.floor(random() * options.length)]);

  let bestChoice: number[] | null = null;
  let bestValue = Infinity;
  let mutations = 0;

  const trials = Math.max(1, job.trials);
  for (let trial = 0; trial < trials; trial++) {
    let choice = randomChoice();
    let value = score(choice);
    let sinceImprovement = 0;

    while (
      value > job.stopCondition &&
      Date.now() - started < budget &&
      sinceImprovement < 400 * problem.componentCount
    ) {
      const id = Math.floor(random() * problem.componentCount);
      const options = problem.allowed[id].filter((base) => base !== choice[id]);
      if (options.length === 0) {
        sinceImprovement += 1;
        continue;
      }
      const candidate = choice.slice();
      candidate[id] = options[Math.floor(random() * options.length)];
      const candidateValue = score(candidate);
      mutations += 1;
      if (candidateValue <= value) {
        if (candidateValue < value - 1e-12) sinceImprovement = 0;
        else sinceImprovement += 1;
        choice = candidate;
        value = candidateValue;
        onProgress?.(value, mutations);
      } else {
        sinceImprovement += 1;
      }
    }

    if (value < bestValue) {
      bestValue = value;
      bestChoice = choice;
    }
    if (bestValue <= job.stopCondition || Date.now() - started >= budget) break;
  }

  const finalChoice = bestChoice ?? randomChoice();
  const bases = materialize(problem, finalChoice);
  const sequences = strandSequences(problem, bases);
  const material = problem.material;

  const complexes = problem.targets.map((target) => {
    const seq = makeNickedSequence(target.order.map((index) => sequences[index]));
    const partition = partitionFunction(seq, model, { pairs: true });
    const minimum = mfe(seq, model);
    const defect = ensembleDefect(target.pairs, partition);
    const energy = structureEnergyOf(seq, target.pairs, model);
    return {
      name: target.name,
      sequence: target.order
        .map((index) => decodeSequence(sequences[index], material))
        .join("+"),
      structure: formatPairs(target.pairs, target.strandLengths),
      ensembleDefect: defect,
      normalizedDefect: seq.n > 0 ? defect / seq.n : 0,
      structureFreeEnergy: energy,
      complexFreeEnergy: partition.freeEnergy,
      probability: Math.exp(-(energy - partition.freeEnergy) / model.RT),
      mfeDefect: mfeDefect(target.pairs, minimum.pairs),
    };
  });

  const tubes =
    objective === "multitube" ? evaluateDefect(context, sequences).detail : [];

  return {
    domains: job.domains.map((domain, index) => ({
      name: domain.name,
      sequence: decodeSequence(
        Array.from(
          bases.slice(
            problem.domainOffsets[index],
            problem.domainOffsets[index] + problem.domainLengths[index],
          ),
        ),
        material,
      ),
    })),
    strands: job.strands.map((strand, index) => ({
      name: strand.name,
      sequence: decodeSequence(sequences[index], material),
    })),
    defect: bestValue,
    stopConditionMet: bestValue <= job.stopCondition,
    mutations,
    seconds: (Date.now() - started) / 1000,
    complexes,
    tubes,
  };
}

// Imported late to keep the module graph acyclic in the bundler's eyes.
import { structureEnergy as structureEnergyOf } from "./energy";
import { formatStructure as formatPairs } from "./structure";
export { makeComplexId };
