/**
 * Test tube analysis: the ensemble of complexes that a set of strand species
 * forms at equilibrium, their concentrations, base-pairing properties and
 * melt profiles.
 */
import { Model, type ModelSpec } from "./model";
import {
  type ComplexEnergy,
  type ComplexId,
  type ComplexResult,
  type StrandSpecies,
  complexFreeEnergy,
  complexStructure,
  enumerateComplexes,
  makeComplexId,
} from "./complex";
import { solveConcentrations } from "./concentrations";
import { formatStructure } from "./structure";

export interface TubeSpec {
  name: string;
  /** Total concentration (molar) of each strand species, aligned with species. */
  concentrations: number[];
  maxComplexSize: number;
  /** Extra complexes to include, as strand-species index lists. */
  include?: number[][];
  /** Complexes to drop, as strand-species index lists. */
  exclude?: number[][];
}

export interface JobSpec {
  model: ModelSpec;
  species: StrandSpecies[];
  tubes: TubeSpec[];
}

export interface ComplexOutcome {
  id: ComplexId;
  freeEnergy: number;
  concentration: number;
  mfeEnergy: number;
  mfeStructure: string;
  /** Strand order of the dominant ordering, by species index. */
  order: number[];
  pairProbabilities: Float64Array;
  unpaired: Float64Array;
  expectedUnpaired: number;
  /** False when the structural pass was skipped because the complex is rare. */
  structureComputed: boolean;
  n: number;
}

export interface TubeOutcome {
  name: string;
  complexes: ComplexOutcome[];
  /** Fraction of all nucleotides in the tube that are unpaired. */
  fractionUnpaired: number;
  converged: boolean;
}

export interface AnalysisOutcome {
  celsius: number;
  tubes: TubeOutcome[];
}

function complexKey(counts: number[]): string {
  return counts.join(",");
}

/** The set of complexes a tube considers, after includes and excludes. */
export function tubeComplexes(
  species: StrandSpecies[],
  tube: TubeSpec,
): ComplexId[] {
  const present = species.map((_, index) => (tube.concentrations[index] ?? 0) > 0);
  const base = enumerateComplexes(species, tube.maxComplexSize).filter((id) =>
    id.counts.every((count, index) => count === 0 || present[index]),
  );
  const byKey = new Map<string, ComplexId>();
  for (const id of base) byKey.set(complexKey(id.counts), id);

  for (const order of tube.include ?? []) {
    const counts = new Array(species.length).fill(0);
    for (const index of order) counts[index] += 1;
    const id = makeComplexId(species, counts);
    byKey.set(complexKey(counts), id);
  }
  for (const order of tube.exclude ?? []) {
    const counts = new Array(species.length).fill(0);
    for (const index of order) counts[index] += 1;
    byKey.delete(complexKey(counts));
  }

  // Every species present needs its monomer, or mass conservation is infeasible.
  species.forEach((_, index) => {
    if (!present[index]) return;
    const counts = new Array(species.length).fill(0);
    counts[index] = 1;
    const key = complexKey(counts);
    if (!byKey.has(key)) byKey.set(key, makeComplexId(species, counts));
  });

  return [...byKey.values()].sort(
    (a, b) => a.size - b.size || a.name.localeCompare(b.name),
  );
}


const EMPTY = new Float64Array(0);

export interface AnalysisOptions {
  /**
   * Complexes whose concentration falls below this fraction of the smallest
   * strand total skip the MFE / pair-probability pass.
   */
  structureThreshold?: number;
}

/** Runs every tube of a job at one temperature. */
export function analyzeJob(
  spec: JobSpec,
  celsius: number,
  options?: AnalysisOptions,
): AnalysisOutcome {
  const model = new Model({ ...spec.model, celsius });
  const energyCache = new Map<string, ComplexEnergy>();
  const structureCache = new Map<string, ComplexResult>();
  // Complexes below this fraction of the smallest strand total contribute
  // nothing visible, so their structural pass is skipped.
  const smallestTotal = Math.min(...spec.tubes.flatMap((t) => t.concentrations.filter((c) => c > 0)));
  const threshold = (options?.structureThreshold ?? 1e-6) * (Number.isFinite(smallestTotal) ? smallestTotal : 1);

  const tubes = spec.tubes.map((tube) => {
    const ids = tubeComplexes(spec.species, tube);
    const energies = ids.map((id) => {
      const key = complexKey(id.counts);
      const cached = energyCache.get(key);
      if (cached) return cached;
      const computed = complexFreeEnergy(spec.species, id, model);
      energyCache.set(key, computed);
      return computed;
    });

    const usable = energies.filter((result) => Number.isFinite(result.freeEnergy));
    const solution = solveConcentrations({
      composition: usable.map((result) => result.id.counts),
      freeEnergies: usable.map((result) => result.freeEnergy),
      totals: tube.concentrations,
      RT: model.RT,
    });

    const complexes: ComplexOutcome[] = usable.map((entry, index) => {
      const concentration = solution.concentrations[index];
      const key = complexKey(entry.id.counts);
      let result = structureCache.get(key);
      if (!result && concentration >= threshold) {
        result = complexStructure(entry, model);
        structureCache.set(key, result);
      }
      const n = entry.dominant.seq.n;
      return {
        id: entry.id,
        freeEnergy: entry.freeEnergy,
        concentration,
        mfeEnergy: result?.mfeEnergy ?? NaN,
        mfeStructure: result ? formatStructure(result.mfePairs, result.dominant.strandLengths) : "",
        order: entry.dominant.order,
        pairProbabilities: result?.pairProbabilities ?? EMPTY,
        unpaired: result?.unpaired ?? EMPTY,
        expectedUnpaired: result?.expectedUnpaired ?? 0,
        structureComputed: Boolean(result),
        n,
      };
    });

    let unpairedTotal = 0;
    let nucleotideTotal = 0;
    complexes.forEach((entry) => {
      unpairedTotal += entry.concentration * entry.expectedUnpaired;
    });
    spec.species.forEach((strand, index) => {
      nucleotideTotal += (tube.concentrations[index] ?? 0) * strand.sequence.length;
    });

    complexes.sort((a, b) => b.concentration - a.concentration);

    return {
      name: tube.name,
      complexes,
      fractionUnpaired: nucleotideTotal > 0 ? unpairedTotal / nucleotideTotal : 0,
      converged: solution.converged,
    };
  });

  return { celsius, tubes };
}

export interface MeltPoint {
  celsius: number;
  fractionUnpaired: number[];
}

/** Melt profile: one analysis per temperature step. */
export function meltProfile(
  spec: JobSpec,
  range: { min: number; max: number; step: number },
  options?: AnalysisOptions,
): { points: MeltPoint[]; outcomes: AnalysisOutcome[] } {
  const temperatures: number[] = [];
  const step = Math.abs(range.step) || 1;
  for (let t = range.min; t <= range.max + 1e-9; t += step) {
    temperatures.push(Number(t.toFixed(6)));
  }
  const outcomes = temperatures.map((celsius) => analyzeJob(spec, celsius, options));
  const points = outcomes.map((outcome) => ({
    celsius: outcome.celsius,
    fractionUnpaired: outcome.tubes.map((tube) => tube.fractionUnpaired),
  }));
  return { points, outcomes };
}

/**
 * Tube ensemble pair fractions: for every nucleotide of every strand species,
 * the fraction of that species' copies in which it pairs with each other
 * nucleotide, aggregated over all complexes weighted by concentration.
 */
export function tubePairFractions(
  species: StrandSpecies[],
  tube: TubeSpec,
  outcome: TubeOutcome,
): { offsets: number[]; total: number; matrix: Float64Array; unpaired: Float64Array } {
  const offsets: number[] = [];
  let total = 0;
  for (const strand of species) {
    offsets.push(total);
    total += strand.sequence.length;
  }
  const matrix = new Float64Array(total * total);
  const unpaired = new Float64Array(total);

  for (const entry of outcome.complexes) {
    const concentration = entry.concentration;
    if (!(concentration > 0)) continue;
    // Map each position of the ordered complex back to (species, offset).
    const map: number[] = [];
    for (const speciesIndex of entry.order) {
      const length = species[speciesIndex].sequence.length;
      for (let k = 0; k < length; k++) map.push(offsets[speciesIndex] + k);
    }
    const n = entry.n;
    for (let i = 0; i < n; i++) {
      unpaired[map[i]] += concentration * entry.unpaired[i];
      for (let j = i + 1; j < n; j++) {
        const probability = entry.pairProbabilities[i * n + j];
        if (probability === 0) continue;
        matrix[map[i] * total + map[j]] += concentration * probability;
        matrix[map[j] * total + map[i]] += concentration * probability;
      }
    }
  }

  // Normalise per strand species by its total concentration.
  species.forEach((strand, index) => {
    const totalConcentration = tube.concentrations[index] ?? 0;
    if (totalConcentration <= 0) return;
    for (let k = 0; k < strand.sequence.length; k++) {
      const row = offsets[index] + k;
      unpaired[row] /= totalConcentration;
      for (let column = 0; column < total; column++) {
        matrix[row * total + column] /= totalConcentration;
      }
    }
  });

  return { offsets, total, matrix, unpaired };
}
