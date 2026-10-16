/**
 * Free energy of one explicit secondary structure, by loop decomposition.
 * This is the quantity the Utilities page reports as "structure free energy",
 * and the reference the brute-force tests check the partition function against.
 */
import { INF, Model, type NickedSequence } from "./model";

export interface LoopBreakdown {
  kind: "exterior" | "hairpin" | "interior" | "multi" | "nicked";
  closing: [number, number] | null;
  children: Array<[number, number]>;
  nicks: number;
  energy: number;
}

export interface StructureEnergyResult {
  energy: number;
  connected: boolean;
  loops: LoopBreakdown[];
}

/**
 * Walks the loop tree of `pairs` and sums the loop energies. A loop spanning a
 * strand nick is part of the exterior loop and is scored as such; two nicks in
 * one loop mean the polymer graph is disconnected.
 */
export function structureEnergyDetailed(
  seq: NickedSequence,
  pairs: ArrayLike<number>,
  model: Model,
): StructureEnergyResult {
  const n = seq.n;
  const loops: LoopBreakdown[] = [];
  let total = 0;
  let connected = true;

  /**
   * Collects the direct branches of a loop. `from..to` is the loop body and
   * `checkTo` is the last position whose preceding nick still belongs to this
   * loop (for an enclosed loop that is the closing pair's 3' partner).
   */
  function loopScan(from: number, to: number, checkTo: number) {
    const children: Array<[number, number]> = [];
    let nicks = 0;
    let unpaired = 0;
    let k = from;
    while (k <= checkTo) {
      if (seq.nickBefore[k]) nicks += 1;
      if (k <= to) {
        const partner = pairs[k];
        if (partner > k && partner <= to) {
          children.push([k, partner]);
          k = partner + 1;
          continue;
        }
        unpaired += 1;
      }
      k += 1;
    }
    return { children, nicks, unpaired };
  }

  const exterior = loopScan(0, n - 1, n - 1);
  let exteriorEnergy = 0;
  for (const [d, e] of exterior.children) {
    const branch = model.exteriorBranch(seq, d, e);
    if (branch >= INF) return { energy: Infinity, connected: false, loops: [] };
    exteriorEnergy += branch;
  }
  if (exterior.nicks > 0) connected = false;
  loops.push({
    kind: "exterior",
    closing: null,
    children: exterior.children,
    nicks: exterior.nicks,
    energy: exteriorEnergy,
  });
  total += exteriorEnergy;

  const queue = [...exterior.children];
  while (queue.length > 0) {
    const [i, j] = queue.pop() as [number, number];
    const inner = loopScan(i + 1, j - 1, j);

    let energy: number;
    let kind: LoopBreakdown["kind"];
    if (inner.nicks > 1) {
      connected = false;
      energy = Infinity;
      kind = "nicked";
    } else if (inner.nicks === 1) {
      kind = "nicked";
      energy = model.nickedClosing(seq, i, j);
      for (const [d, e] of inner.children) energy += model.exteriorBranch(seq, d, e);
    } else if (inner.children.length === 0) {
      kind = "hairpin";
      energy = model.hairpin(seq, i, j);
    } else if (inner.children.length === 1) {
      kind = "interior";
      const [p, q] = inner.children[0];
      energy = model.interior(seq, i, j, p, q);
    } else {
      kind = "multi";
      energy = model.multiClosing(seq, i, j) + model.multiBase * inner.unpaired;
      for (const [d, e] of inner.children) energy += model.multiBranch(seq, d, e);
    }
    loops.push({ kind, closing: [i, j], children: inner.children, nicks: inner.nicks, energy });
    total += energy;
    queue.push(...inner.children);
  }

  total += model.joinPenalty * (seq.strandCount - 1);
  return { energy: total, connected, loops };
}

export function structureEnergy(
  seq: NickedSequence,
  pairs: ArrayLike<number>,
  model: Model,
): number {
  return structureEnergyDetailed(seq, pairs, model).energy;
}
