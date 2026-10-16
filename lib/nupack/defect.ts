/**
 * Quantities that compare a target secondary structure with the equilibrium
 * ensemble of the complex it belongs to.
 *
 * With the structure matrix S (S_ij = 1 when i pairs j, S_i,N+1 = 1 when i is
 * unpaired) and the equilibrium pair probability matrix P:
 *   ensemble defect  n(phi, s) = N - sum_ij P_ij S_ij
 *   MFE defect       mu(phi, s) = N - sum_ij S_ij(s_MFE) S_ij(s)
 * and the structure's equilibrium probability is exp(-(dG(phi,s) - dG(phi))/kT).
 */
import { Model, type NickedSequence } from "./model";
import { structureEnergy } from "./energy";
import { mfe } from "./mfe";
import { partitionFunction, type PartitionResult } from "./pf";

export interface StructureAnalysis {
  /** Free energy of the complex ensemble, -kT log Q. */
  complexFreeEnergy: number;
  /** Free energy of the specified structure. */
  structureFreeEnergy: number;
  /** Equilibrium probability of the specified structure. */
  probability: number;
  ensembleDefect: number;
  normalizedEnsembleDefect: number;
  mfeDefect: number;
  normalizedMfeDefect: number;
}

/** n(phi, s) given a precomputed pair probability matrix. */
export function ensembleDefect(
  pairs: ArrayLike<number>,
  partition: PartitionResult,
): number {
  const n = partition.n;
  let overlap = 0;
  for (let i = 0; i < n; i++) {
    const partner = pairs[i];
    if (partner < 0) overlap += partition.unpaired![i];
    else overlap += partition.pairProbabilities![i * n + partner];
  }
  return n - overlap;
}

/** mu(phi, s): nucleotides whose pairing state differs from the MFE structure. */
export function mfeDefect(
  pairs: ArrayLike<number>,
  mfePairs: ArrayLike<number>,
): number {
  const n = pairs.length;
  let matched = 0;
  for (let i = 0; i < n; i++) {
    if (pairs[i] === mfePairs[i]) matched += 1;
  }
  return n - matched;
}

export function analyzeStructure(
  seq: NickedSequence,
  pairs: ArrayLike<number>,
  model: Model,
): StructureAnalysis {
  const partition = partitionFunction(seq, model, { pairs: true });
  const structure = structureEnergy(seq, pairs, model);
  const minimum = mfe(seq, model);
  const n = seq.n;
  const defect = ensembleDefect(pairs, partition);
  const mu = mfeDefect(pairs, minimum.pairs);
  return {
    complexFreeEnergy: partition.freeEnergy,
    structureFreeEnergy: structure,
    probability: Math.exp(-(structure - partition.freeEnergy) / model.RT),
    ensembleDefect: defect,
    normalizedEnsembleDefect: n > 0 ? defect / n : 0,
    mfeDefect: mu,
    normalizedMfeDefect: n > 0 ? mu / n : 0,
  };
}

/** Probability of one structure within its complex ensemble. */
export function structureProbability(
  seq: NickedSequence,
  pairs: ArrayLike<number>,
  model: Model,
): number {
  const partition = partitionFunction(seq, model);
  const structure = structureEnergy(seq, pairs, model);
  return Math.exp(-(structure - partition.freeEnergy) / model.RT);
}
