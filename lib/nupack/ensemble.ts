/**
 * Ensemble size: how many unpseudoknotted secondary structures a complex can
 * adopt. This is the partition function with every structure weighted 1, so
 * the same O(N^3) recursion counts them exactly.
 *
 * Counts blow up exponentially, so they are accumulated as floats and also
 * reported as a base-10 logarithm.
 */
import { MIN_HAIRPIN } from "./alphabet";
import { Model, type NickedSequence, nickFree } from "./model";

export interface EnsembleSizeResult {
  /** Exact count when it fits a double, otherwise an approximation. */
  count: number;
  log10: number;
  exact: boolean;
}

export function ensembleSize(seq: NickedSequence, model: Model): EnsembleSizeResult {
  const n = seq.n;
  if (n === 0) return { count: 1, log10: 0, exact: true };
  const size = n * n;
  const qb = new Float64Array(size);
  const qm = new Float64Array(size);
  const qm1 = new Float64Array(size);
  const d = new Float64Array(size);
  const s = seq.bases;
  const dAt = (a: number, b: number) => (b < a ? 1 : d[a * n + b]);

  for (let span = 1; span <= n; span++) {
    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      if (model.pair(s[i], s[j]) === 0) continue;
      if (span < MIN_HAIRPIN + 2 && nickFree(seq, i, j)) continue;
      let total = 0;
      if (nickFree(seq, i, j)) total += 1; // hairpin
      for (let p = i + 1; p <= j - 2; p++) {
        if (!nickFree(seq, i, p)) break;
        for (let q = j - 1; q > p; q--) {
          if (!nickFree(seq, q, j)) break;
          total += qb[p * n + q];
        }
      }
      if (seq.nickBefore[j] === 0) {
        for (let k = i + 2; k < j; k++) {
          total += qm[(i + 1) * n + (k - 1)] * qm1[k * n + (j - 1)];
        }
      }
      {
        const a = i + 1;
        const b = j - 1;
        for (let k = a; k <= b + 1; k++) {
          if (!seq.nickBefore[k]) continue;
          const left = k === a ? 1 : seq.nickBefore[a] ? 0 : dAt(a, k - 1);
          if (left === 0) continue;
          const right = k === b + 1 ? 1 : seq.nickBefore[b + 1] ? 0 : dAt(k, b);
          if (right === 0) continue;
          total += left * right;
        }
      }
      qb[i * n + j] = total;
    }

    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      let total = 0;
      if (span > 1 && seq.nickBefore[j] === 0) total += qm1[i * n + (j - 1)];
      total += qb[i * n + j];
      qm1[i * n + j] = total;
    }

    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      let total = 0;
      for (let k = i; k <= j; k++) {
        const one = qm1[k * n + j];
        if (one === 0) continue;
        if (nickFree(seq, i - 1, k)) total += one;
        if (k > i && seq.nickBefore[k] === 0) total += qm[i * n + (k - 1)] * one;
      }
      qm[i * n + j] = total;
    }

    for (let a = 0; a + span - 1 < n; a++) {
      const b = a + span - 1;
      let total = 0;
      if (b === a || seq.nickBefore[b] === 0) total += dAt(a, b - 1);
      for (let dStart = a; dStart < b; dStart++) {
        const branch = qb[dStart * n + b];
        if (branch === 0) continue;
        const prefix = dStart === a ? 1 : seq.nickBefore[dStart] ? 0 : dAt(a, dStart - 1);
        if (prefix === 0) continue;
        total += prefix * branch;
      }
      d[a * n + b] = total;
    }
  }

  const count = d[0 * n + (n - 1)];
  return {
    count,
    log10: Math.log10(count),
    exact: Number.isSafeInteger(count),
  };
}

/**
 * The O(N^4) matrices from Dirks & Pierce (2003) that the ensemble-size
 * recursion fills in. Exposed because the Utilities page shows them.
 */
export interface EnsembleMatrices {
  q: Float64Array;
  qb: Float64Array;
  qm: Float64Array;
  n: number;
}
