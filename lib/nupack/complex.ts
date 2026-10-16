/**
 * Complexes: multisets of interacting strands.
 *
 * A complex is identified by how many copies of each strand species it holds.
 * Its partition function sums over the distinct circular strand orderings, each
 * divided by its rotational symmetry, which is the usual symmetry correction
 * -kT log R applied to the free energy.
 */
import { decodeSequence, type Material } from "./alphabet";
import { Model, makeNickedSequence, type NickedSequence } from "./model";
import { mfe } from "./mfe";
import { partitionFunction } from "./pf";

export interface StrandSpecies {
  name: string;
  /** Encoded bases. */
  sequence: number[];
}

export interface ComplexId {
  /** Count of each strand species, aligned with the species list. */
  counts: number[];
  /** Canonical name, e.g. "A+B" or "A+A+B". */
  name: string;
  /** Total strand count. */
  size: number;
  /** Total nucleotides. */
  length: number;
}

export interface OrderedComplex {
  /** Strand indices in order around the complex. */
  order: number[];
  /** Rotational symmetry of this circular ordering. */
  symmetry: number;
  seq: NickedSequence;
  strandLengths: number[];
}

export interface ComplexResult {
  id: ComplexId;
  /** -kT log Q for the complex, including the symmetry correction. */
  freeEnergy: number;
  logQ: number;
  /** The ordering with the lowest free energy; structure results refer to it. */
  dominant: OrderedComplex;
  mfeEnergy: number;
  mfePairs: Int32Array;
  pairProbabilities: Float64Array;
  unpaired: Float64Array;
  /** Expected number of unpaired bases at equilibrium. */
  expectedUnpaired: number;
  orderings: Array<{ order: number[]; symmetry: number; freeEnergy: number }>;
}

/** All multisets of strands with total size between 1 and maxSize. */
export function enumerateComplexes(
  species: StrandSpecies[],
  maxSize: number,
): ComplexId[] {
  const out: ComplexId[] = [];
  const counts = new Array(species.length).fill(0);

  function recurse(index: number, remaining: number) {
    if (index === species.length) {
      const size = counts.reduce((a, b) => a + b, 0);
      if (size >= 1) out.push(makeComplexId(species, counts.slice()));
      return;
    }
    for (let take = 0; take <= remaining; take++) {
      counts[index] = take;
      recurse(index + 1, remaining - take);
    }
    counts[index] = 0;
  }

  recurse(0, maxSize);
  out.sort((a, b) => a.size - b.size || a.name.localeCompare(b.name));
  return out;
}

export function makeComplexId(species: StrandSpecies[], counts: number[]): ComplexId {
  const parts: string[] = [];
  let length = 0;
  let size = 0;
  counts.forEach((count, index) => {
    for (let k = 0; k < count; k++) parts.push(species[index].name);
    length += count * species[index].sequence.length;
    size += count;
  });
  return { counts, name: parts.join("+"), size, length };
}

/** Distinct circular orderings (necklaces) of a strand multiset. */
export function orderedComplexes(
  species: StrandSpecies[],
  counts: number[],
): Array<{ order: number[]; symmetry: number }> {
  const items: number[] = [];
  counts.forEach((count, index) => {
    for (let k = 0; k < count; k++) items.push(index);
  });
  const seen = new Set<string>();
  const result: Array<{ order: number[]; symmetry: number }> = [];

  const permute = (remaining: number[], acc: number[]) => {
    if (remaining.length === 0) {
      const canonical = canonicalRotation(acc);
      const key = canonical.join(",");
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ order: canonical, symmetry: rotationalSymmetry(canonical) });
      return;
    }
    const used = new Set<number>();
    for (let i = 0; i < remaining.length; i++) {
      if (used.has(remaining[i])) continue;
      used.add(remaining[i]);
      const next = remaining.slice();
      const [picked] = next.splice(i, 1);
      permute(next, [...acc, picked]);
    }
  };

  permute(items, []);
  return result;
}

function canonicalRotation(order: number[]): number[] {
  let best = order;
  let bestKey = order.join(",");
  for (let shift = 1; shift < order.length; shift++) {
    const rotated = [...order.slice(shift), ...order.slice(0, shift)];
    const key = rotated.join(",");
    if (key < bestKey) {
      bestKey = key;
      best = rotated;
    }
  }
  return best;
}

function rotationalSymmetry(order: number[]): number {
  const length = order.length;
  let count = 0;
  for (let shift = 0; shift < length; shift++) {
    let same = true;
    for (let i = 0; i < length; i++) {
      if (order[i] !== order[(i + shift) % length]) {
        same = false;
        break;
      }
    }
    if (same) count += 1;
  }
  return count;
}

/** Builds the concatenated sequence for one ordering. */
export function buildOrdered(
  species: StrandSpecies[],
  order: number[],
  symmetry: number,
): OrderedComplex {
  const strands = order.map((index) => species[index].sequence);
  return {
    order,
    symmetry,
    seq: makeNickedSequence(strands),
    strandLengths: strands.map((s) => s.length),
  };
}

const LOG_ZERO = -Infinity;

function logSumExp(values: number[]): number {
  const max = Math.max(...values);
  if (!Number.isFinite(max)) return max;
  let sum = 0;
  for (const value of values) sum += Math.exp(value - max);
  return max + Math.log(sum);
}

export interface ComplexEnergy {
  id: ComplexId;
  logQ: number;
  freeEnergy: number;
  dominant: OrderedComplex;
  orderings: Array<{ order: number[]; symmetry: number; freeEnergy: number }>;
}

/**
 * Free energy only. Tube analysis runs this for every candidate complex and
 * reserves the more expensive structural pass for the ones that actually
 * reach a meaningful concentration.
 */
export function complexFreeEnergy(
  species: StrandSpecies[],
  id: ComplexId,
  model: Model,
): ComplexEnergy {
  const orders = orderedComplexes(species, id.counts);
  const logs: number[] = [];
  const details: Array<{ order: number[]; symmetry: number; freeEnergy: number }> = [];
  let best: { ordered: OrderedComplex; logQ: number } | null = null;

  for (const { order, symmetry } of orders) {
    const ordered = buildOrdered(species, order, symmetry);
    const pf = partitionFunction(ordered.seq, model);
    const adjusted = pf.logQ - Math.log(symmetry);
    logs.push(Number.isFinite(adjusted) ? adjusted : LOG_ZERO);
    details.push({
      order,
      symmetry,
      freeEnergy: Number.isFinite(pf.logQ) ? -model.RT * adjusted : Infinity,
    });
    if (best === null || adjusted > best.logQ) best = { ordered, logQ: adjusted };
  }

  const logQ = logSumExp(logs);
  return {
    id,
    logQ,
    freeEnergy: Number.isFinite(logQ) ? -model.RT * logQ : Infinity,
    dominant: best!.ordered,
    orderings: details,
  };
}

/** Adds MFE structure and pair probabilities for the dominant ordering. */
export function complexStructure(
  energy: ComplexEnergy,
  model: Model,
): ComplexResult {
  const { dominant } = energy;
  const structural = partitionFunction(dominant.seq, model, { pairs: true });
  const minimum = mfe(dominant.seq, model);
  let expectedUnpaired = 0;
  for (let i = 0; i < dominant.seq.n; i++) expectedUnpaired += structural.unpaired![i];
  return {
    id: energy.id,
    logQ: energy.logQ,
    freeEnergy: energy.freeEnergy,
    dominant,
    mfeEnergy: minimum.energy,
    mfePairs: minimum.pairs,
    pairProbabilities: structural.pairProbabilities!,
    unpaired: structural.unpaired!,
    expectedUnpaired,
    orderings: energy.orderings,
  };
}

/** Full analysis of a single complex: free energy, MFE and pair probabilities. */
export function analyzeComplex(
  species: StrandSpecies[],
  id: ComplexId,
  model: Model,
): ComplexResult {
  return complexStructure(complexFreeEnergy(species, id, model), model);
}

/** Renders the concatenated sequence of an ordering as text with "+" nicks. */
export function orderedSequenceText(
  species: StrandSpecies[],
  order: number[],
  material: Material,
): string {
  return order.map((index) => decodeSequence(species[index].sequence, material)).join("+");
}
