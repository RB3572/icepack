/**
 * Minimum free energy structure for one ordered complex.
 *
 * Mirrors the recursions in pf.ts with min-plus in place of sum-product, then
 * tracks back through the same cases to recover the structure. The nick rules
 * are identical, so the MFE structure is always a connected one.
 */
import { MIN_HAIRPIN } from "./alphabet";
import { INF, MAXLOOP, Model, type NickedSequence, nickFree } from "./model";

export interface MfeResult {
  energy: number;
  pairs: Int32Array;
}

interface MfeTables {
  eb: Float64Array;
  em: Float64Array;
  em1: Float64Array;
  ed: Float64Array;
  n: number;
}

const BIG = 1e8;

function mfeTables(seq: NickedSequence, model: Model): MfeTables {
  const n = seq.n;
  const size = n * n;
  const eb = new Float64Array(size).fill(BIG);
  const em = new Float64Array(size).fill(BIG);
  const em1 = new Float64Array(size).fill(BIG);
  const ed = new Float64Array(size).fill(BIG);
  const s = seq.bases;
  const b = model.multiBase;

  const dAt = (a: number, bb: number) => (bb < a ? 0 : ed[a * n + bb]);

  for (let span = 1; span <= n; span++) {
    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      if (model.pair(s[i], s[j]) === 0) continue;
      if (span < MIN_HAIRPIN + 2 && nickFree(seq, i, j)) continue;
      let best = BIG;

      if (nickFree(seq, i, j)) {
        const eh = model.hairpin(seq, i, j);
        if (eh < best) best = eh;
      }

      const maxP = Math.min(j - 2, i + MAXLOOP + 1);
      for (let p = i + 1; p <= maxP; p++) {
        if (!nickFree(seq, i, p)) break;
        const minQ = Math.max(p + 1, j - 1 - (MAXLOOP - (p - i - 1)));
        for (let q = j - 1; q >= minQ; q--) {
          if (!nickFree(seq, q, j)) break;
          const inner = eb[p * n + q];
          if (inner >= BIG) continue;
          const e = model.interior(seq, i, j, p, q);
          if (e >= INF) continue;
          if (e + inner < best) best = e + inner;
        }
      }

      if (seq.nickBefore[j] === 0) {
        const closing = model.multiClosing(seq, i, j);
        if (closing < INF) {
          for (let k = i + 2; k < j; k++) {
            const left = em[(i + 1) * n + (k - 1)];
            if (left >= BIG) continue;
            const right = em1[k * n + (j - 1)];
            if (right >= BIG) continue;
            const value = closing + left + right;
            if (value < best) best = value;
          }
        }
      }

      {
        const closing = model.nickedClosing(seq, i, j);
        if (closing < INF) {
          const a = i + 1;
          const bb = j - 1;
          for (let k = a; k <= bb + 1; k++) {
            if (!seq.nickBefore[k]) continue;
            const leftPart = k === a ? 0 : seq.nickBefore[a] ? BIG : dAt(a, k - 1);
            if (leftPart >= BIG) continue;
            const rightPart =
              k === bb + 1 ? 0 : seq.nickBefore[bb + 1] ? BIG : dAt(k, bb);
            if (rightPart >= BIG) continue;
            const value = closing + leftPart + rightPart;
            if (value < best) best = value;
          }
        }
      }

      eb[i * n + j] = best;
    }

    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      let best = BIG;
      if (span > 1 && seq.nickBefore[j] === 0) {
        const value = em1[i * n + (j - 1)] + b;
        if (value < best) best = value;
      }
      const branch = eb[i * n + j];
      if (branch < BIG) {
        const e = model.multiBranch(seq, i, j);
        if (e < INF && branch + e < best) best = branch + e;
      }
      em1[i * n + j] = best;
    }

    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      let best = BIG;
      for (let k = i; k <= j; k++) {
        const one = em1[k * n + j];
        if (one >= BIG) continue;
        if (nickFree(seq, i - 1, k)) {
          const value = b * (k - i) + one;
          if (value < best) best = value;
        }
        if (k > i && seq.nickBefore[k] === 0) {
          const left = em[i * n + (k - 1)];
          if (left < BIG && left + one < best) best = left + one;
        }
      }
      em[i * n + j] = best;
    }

    for (let a = 0; a + span - 1 < n; a++) {
      const bb = a + span - 1;
      let best = BIG;
      if (bb === a || seq.nickBefore[bb] === 0) {
        const value = dAt(a, bb - 1);
        if (value < best) best = value;
      }
      for (let dStart = a; dStart < bb; dStart++) {
        const branch = eb[dStart * n + bb];
        if (branch >= BIG) continue;
        const prefix =
          dStart === a ? 0 : seq.nickBefore[dStart] ? BIG : dAt(a, dStart - 1);
        if (prefix >= BIG) continue;
        const e = model.exteriorBranch(seq, dStart, bb);
        if (e >= INF) continue;
        const value = prefix + branch + e;
        if (value < best) best = value;
      }
      ed[a * n + bb] = best;
    }
  }

  return { eb, em, em1, ed, n };
}

const TOLERANCE = 1e-9;

export function mfe(seq: NickedSequence, model: Model): MfeResult {
  const n = seq.n;
  const pairs = new Int32Array(n).fill(-1);
  if (n === 0) return { energy: 0, pairs };
  const tables = mfeTables(seq, model);
  const { eb, em, em1, ed } = tables;
  const b = model.multiBase;
  const dAt = (a: number, bb: number) => (bb < a ? 0 : ed[a * n + bb]);

  const addPair = (i: number, j: number) => {
    pairs[i] = j;
    pairs[j] = i;
  };

  /** Exterior region [a, bb] under the D recursion. */
  function traceD(a: number, bb: number) {
    if (bb < a) return;
    const target = ed[a * n + bb];
    if (target >= BIG) return;
    if (bb === a || seq.nickBefore[bb] === 0) {
      if (Math.abs(dAt(a, bb - 1) - target) < TOLERANCE) {
        traceD(a, bb - 1);
        return;
      }
    }
    for (let dStart = a; dStart < bb; dStart++) {
      const branch = eb[dStart * n + bb];
      if (branch >= BIG) continue;
      const prefix =
        dStart === a ? 0 : seq.nickBefore[dStart] ? BIG : dAt(a, dStart - 1);
      if (prefix >= BIG) continue;
      const e = model.exteriorBranch(seq, dStart, bb);
      if (e >= INF) continue;
      if (Math.abs(prefix + branch + e - target) < TOLERANCE) {
        addPair(dStart, bb);
        traceB(dStart, bb);
        if (dStart > a) traceD(a, dStart - 1);
        return;
      }
    }
  }

  function traceB(i: number, j: number) {
    const target = eb[i * n + j];
    if (target >= BIG) return;

    if (nickFree(seq, i, j)) {
      if (Math.abs(model.hairpin(seq, i, j) - target) < TOLERANCE) return;
    }

    const maxP = Math.min(j - 2, i + MAXLOOP + 1);
    for (let p = i + 1; p <= maxP; p++) {
      if (!nickFree(seq, i, p)) break;
      const minQ = Math.max(p + 1, j - 1 - (MAXLOOP - (p - i - 1)));
      for (let q = j - 1; q >= minQ; q--) {
        if (!nickFree(seq, q, j)) break;
        const inner = eb[p * n + q];
        if (inner >= BIG) continue;
        const e = model.interior(seq, i, j, p, q);
        if (e >= INF) continue;
        if (Math.abs(e + inner - target) < TOLERANCE) {
          addPair(p, q);
          traceB(p, q);
          return;
        }
      }
    }

    if (seq.nickBefore[j] === 0) {
      const closing = model.multiClosing(seq, i, j);
      if (closing < INF) {
        for (let k = i + 2; k < j; k++) {
          const left = em[(i + 1) * n + (k - 1)];
          const right = em1[k * n + (j - 1)];
          if (left >= BIG || right >= BIG) continue;
          if (Math.abs(closing + left + right - target) < TOLERANCE) {
            traceM(i + 1, k - 1);
            traceM1(k, j - 1);
            return;
          }
        }
      }
    }

    const closing = model.nickedClosing(seq, i, j);
    if (closing < INF) {
      const a = i + 1;
      const bb = j - 1;
      for (let k = a; k <= bb + 1; k++) {
        if (!seq.nickBefore[k]) continue;
        const leftPart = k === a ? 0 : seq.nickBefore[a] ? BIG : dAt(a, k - 1);
        if (leftPart >= BIG) continue;
        const rightPart =
          k === bb + 1 ? 0 : seq.nickBefore[bb + 1] ? BIG : dAt(k, bb);
        if (rightPart >= BIG) continue;
        if (Math.abs(closing + leftPart + rightPart - target) < TOLERANCE) {
          if (k > a) traceD(a, k - 1);
          if (k <= bb) traceD(k, bb);
          return;
        }
      }
    }
  }

  function traceM1(i: number, j: number) {
    const target = em1[i * n + j];
    if (target >= BIG) return;
    if (j > i && seq.nickBefore[j] === 0) {
      if (Math.abs(em1[i * n + (j - 1)] + b - target) < TOLERANCE) {
        traceM1(i, j - 1);
        return;
      }
    }
    const branch = eb[i * n + j];
    if (branch < BIG) {
      const e = model.multiBranch(seq, i, j);
      if (e < INF && Math.abs(branch + e - target) < TOLERANCE) {
        addPair(i, j);
        traceB(i, j);
      }
    }
  }

  function traceM(i: number, j: number) {
    const target = em[i * n + j];
    if (target >= BIG) return;
    for (let k = i; k <= j; k++) {
      const one = em1[k * n + j];
      if (one >= BIG) continue;
      if (nickFree(seq, i - 1, k) && Math.abs(b * (k - i) + one - target) < TOLERANCE) {
        traceM1(k, j);
        return;
      }
      if (k > i && seq.nickBefore[k] === 0) {
        const left = em[i * n + (k - 1)];
        if (left < BIG && Math.abs(left + one - target) < TOLERANCE) {
          traceM(i, k - 1);
          traceM1(k, j);
          return;
        }
      }
    }
  }

  traceD(0, n - 1);
  const energy = ed[0 * n + (n - 1)] + model.joinPenalty * (seq.strandCount - 1);
  return { energy: energy >= BIG ? Infinity : energy, pairs };
}
