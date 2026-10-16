/**
 * Partition function for one ordered complex, plus the outside recursions that
 * yield equilibrium base-pairing probabilities.
 *
 * The complex is the concatenation of its strands in a fixed order, carrying a
 * nick wherever one strand ends and the next begins. A loop whose unpaired
 * regions span a nick is physically part of the exterior loop, so it is scored
 * with exterior-loop energies.
 *
 * Connectivity. The polymer graph of an unpseudoknotted structure is connected
 * exactly when the exterior loop contains no nick and every other loop contains
 * at most one. (Two nicks in one loop cut its boundary cycle into two arcs, and
 * no base pair of an unpseudoknotted structure can join them.) The recursions
 * below enforce that directly, so the partition function covers connected
 * structures only - no inclusion-exclusion over sub-complexes is needed.
 */
import { MIN_HAIRPIN } from "./alphabet";
import { INF, MAXLOOP, Model, type NickedSequence, nickFree } from "./model";

export interface PartitionResult {
  /** log of the connected-complex partition function (unscaled). */
  logQ: number;
  /** Free energy of the complex, -kT log Q, in kcal/mol. */
  freeEnergy: number;
  /** n x n matrix of equilibrium base-pairing probabilities (row-major). */
  pairProbabilities?: Float64Array;
  /** Probability that each base is unpaired. */
  unpaired?: Float64Array;
  n: number;
}

interface Tables {
  qb: Float64Array;
  qm: Float64Array;
  qm1: Float64Array;
  d: Float64Array;
  scale: Float64Array;
  logScale: number;
  n: number;
}

const EMPTY = new Float64Array(0);

/** Scaling keeps the Boltzmann sums near unity for long complexes. */
function scaleArray(n: number, perBase: number): { scale: Float64Array; logScale: number } {
  const scale = new Float64Array(n + 2);
  const factor = Math.exp(-perBase);
  scale[0] = 1;
  for (let i = 1; i <= n + 1; i++) scale[i] = scale[i - 1] * factor;
  return { scale, logScale: perBase };
}

function inside(seq: NickedSequence, model: Model, perBase: number): Tables {
  const n = seq.n;
  const size = n * n;
  const qb = new Float64Array(size);
  const qm = new Float64Array(size);
  const qm1 = new Float64Array(size);
  const d = new Float64Array(size);
  const { scale, logScale } = scaleArray(n, perBase);
  const s = seq.bases;
  const RT = model.RT;
  const wUnpairedMulti = Math.exp(-model.multiBase / RT);

  // D(a, a-1) = 1 for the empty interval; stored separately since the arrays
  // are indexed by a <= b only.
  const dEmpty = 1;
  const dAt = (a: number, b: number) => (b < a ? dEmpty : d[a * n + b]);

  for (let span = 1; span <= n; span++) {
    // --- Qb: i pairs j -------------------------------------------------
    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      const type = model.pair(s[i], s[j]);
      if (type === 0) continue;
      // A short span is only forbidden when the enclosed region is a real
      // hairpin loop; across a nick the region is exterior and may be empty.
      if (span < MIN_HAIRPIN + 2 && nickFree(seq, i, j)) continue;
      let total = 0;

      // hairpin: the whole enclosed region is one loop, so it must hold no nick
      if (nickFree(seq, i, j)) {
        const eh = model.hairpin(seq, i, j);
        if (eh < INF) total += Math.exp(-eh / RT) * scale[span];
      }

      // interior loops (stack, bulge, internal); each side must be nick-free,
      // but a nick nested inside the enclosed pair is fine.
      const maxP = Math.min(j - 2, i + MAXLOOP + 1);
      for (let p = i + 1; p <= maxP; p++) {
        if (!nickFree(seq, i, p)) break;
        const minQ = Math.max(p + 1, j - 1 - (MAXLOOP - (p - i - 1)));
        for (let q = j - 1; q >= minQ; q--) {
          if (!nickFree(seq, q, j)) break;
          const inner = qb[p * n + q];
          if (inner === 0) continue;
          const e = model.interior(seq, i, j, p, q);
          if (e >= INF) continue;
          total += Math.exp(-e / RT) * inner * scale[p - i + (j - q)];
        }
      }

      // multiloop closed by (i, j); Qm/Qm1 keep the loop's gaps nick-free
      if (seq.nickBefore[j] === 0) {
        const closing = model.multiClosing(seq, i, j);
        if (closing < INF) {
          let sum = 0;
          for (let k = i + 2; k < j; k++) {
            const left = qm[(i + 1) * n + (k - 1)];
            if (left === 0) continue;
            const right = qm1[k * n + (j - 1)];
            if (right === 0) continue;
            sum += left * right;
          }
          if (sum > 0) total += Math.exp(-closing / RT) * sum * scale[2];
        }
      }

      // the loop closed by (i, j) carries exactly one nick: exterior-like
      {
        const closing = model.nickedClosing(seq, i, j);
        if (closing < INF) {
          const a = i + 1;
          const b = j - 1;
          let sum = 0;
          for (let k = a; k <= b + 1; k++) {
            if (!seq.nickBefore[k]) continue;
            const leftPart = k === a ? 1 : seq.nickBefore[a] ? 0 : dAt(a, k - 1);
            if (leftPart === 0) continue;
            const rightPart =
              k === b + 1 ? 1 : seq.nickBefore[b + 1] ? 0 : dAt(k, b);
            if (rightPart === 0) continue;
            sum += leftPart * rightPart;
          }
          if (sum > 0) total += Math.exp(-closing / RT) * sum * scale[2];
        }
      }

      qb[i * n + j] = total;
    }

    // --- Qm1: exactly one branch, opening at i -------------------------
    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      let total = 0;
      if (span > 1 && seq.nickBefore[j] === 0) {
        total += qm1[i * n + (j - 1)] * wUnpairedMulti * scale[1];
      }
      const branch = qb[i * n + j];
      if (branch !== 0) {
        const e = model.multiBranch(seq, i, j);
        if (e < INF) total += branch * Math.exp(-e / RT);
      }
      qm1[i * n + j] = total;
    }

    // --- Qm: at least one branch inside a multiloop --------------------
    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      let total = 0;
      for (let k = i; k <= j; k++) {
        const one = qm1[k * n + j];
        if (one === 0) continue;
        // leading run of unpaired bases i..k-1
        if (nickFree(seq, i - 1, k)) {
          total += Math.pow(wUnpairedMulti, k - i) * scale[k - i] * one;
        }
        if (k > i && seq.nickBefore[k] === 0) {
          total += qm[i * n + (k - 1)] * one;
        }
      }
      qm[i * n + j] = total;
    }

    // --- D: exterior loop with every nick covered by a branch ----------
    for (let a = 0; a + span - 1 < n; a++) {
      const b = a + span - 1;
      let total = 0;
      if (b === a || seq.nickBefore[b] === 0) {
        total += dAt(a, b - 1) * scale[1];
      }
      for (let dStart = a; dStart < b; dStart++) {
        const branch = qb[dStart * n + b];
        if (branch === 0) continue;
        const prefix =
          dStart === a ? 1 : seq.nickBefore[dStart] ? 0 : dAt(a, dStart - 1);
        if (prefix === 0) continue;
        const e = model.exteriorBranch(seq, dStart, b);
        if (e >= INF) continue;
        total += prefix * branch * Math.exp(-e / RT);
      }
      d[a * n + b] = total;
    }
  }

  return { qb, qm, qm1, d, scale, logScale, n };
}

/**
 * Outside recursions. `oX[i][j]` accumulates the derivative of the total
 * partition function with respect to the inside value `X[i][j]`, so that
 * P(i, j) = Qb[i][j] * oQb[i][j] / Q.
 */
function outside(
  seq: NickedSequence,
  model: Model,
  tables: Tables,
): Float64Array {
  const { qb, qm, qm1, d, scale, n } = tables;
  const size = n * n;
  const oqb = new Float64Array(size);
  const oqm = new Float64Array(size);
  const oqm1 = new Float64Array(size);
  const od = new Float64Array(size);
  const s = seq.bases;
  const RT = model.RT;
  const wUnpairedMulti = Math.exp(-model.multiBase / RT);

  // Contributions flowing into the empty interval D(a, a-1) are dead ends.
  const dAt = (a: number, b: number) => (b < a ? 1 : d[a * n + b]);
  const addD = (a: number, b: number, value: number) => {
    if (b < a) return;
    od[a * n + b] += value;
  };

  od[0 * n + (n - 1)] = 1;

  for (let span = n; span >= 1; span--) {
    // --- D ---------------------------------------------------------------
    for (let a = 0; a + span - 1 < n; a++) {
      const b = a + span - 1;
      const outer = od[a * n + b];
      if (outer === 0) continue;
      if (b === a || seq.nickBefore[b] === 0) {
        addD(a, b - 1, outer * scale[1]);
      }
      for (let dStart = a; dStart < b; dStart++) {
        const branch = qb[dStart * n + b];
        if (branch === 0) continue;
        const prefix =
          dStart === a ? 1 : seq.nickBefore[dStart] ? 0 : dAt(a, dStart - 1);
        if (prefix === 0) continue;
        const e = model.exteriorBranch(seq, dStart, b);
        if (e >= INF) continue;
        const weight = Math.exp(-e / RT);
        oqb[dStart * n + b] += outer * prefix * weight;
        if (dStart > a) addD(a, dStart - 1, outer * branch * weight);
      }
    }

    // --- Qm --------------------------------------------------------------
    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      const outer = oqm[i * n + j];
      if (outer === 0) continue;
      for (let k = i; k <= j; k++) {
        const one = qm1[k * n + j];
        if (nickFree(seq, i - 1, k)) {
          const run = Math.pow(wUnpairedMulti, k - i) * scale[k - i];
          oqm1[k * n + j] += outer * run;
        }
        if (k > i && seq.nickBefore[k] === 0) {
          if (one !== 0) oqm[i * n + (k - 1)] += outer * one;
          oqm1[k * n + j] += outer * qm[i * n + (k - 1)];
        }
      }
    }

    // --- Qm1 -------------------------------------------------------------
    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      const outer = oqm1[i * n + j];
      if (outer === 0) continue;
      if (span > 1 && seq.nickBefore[j] === 0) {
        oqm1[i * n + (j - 1)] += outer * wUnpairedMulti * scale[1];
      }
      if (qb[i * n + j] !== 0) {
        const e = model.multiBranch(seq, i, j);
        if (e < INF) oqb[i * n + j] += outer * Math.exp(-e / RT);
      }
    }

    // --- Qb --------------------------------------------------------------
    for (let i = 0; i + span - 1 < n; i++) {
      const j = i + span - 1;
      const outer = oqb[i * n + j];
      if (outer === 0) continue;
      const type = model.pair(s[i], s[j]);
      if (type === 0) continue;
      if (span < MIN_HAIRPIN + 2 && nickFree(seq, i, j)) continue;

      {
        const maxP = Math.min(j - 2, i + MAXLOOP + 1);
        for (let p = i + 1; p <= maxP; p++) {
          if (!nickFree(seq, i, p)) break;
          const minQ = Math.max(p + 1, j - 1 - (MAXLOOP - (p - i - 1)));
          for (let q = j - 1; q >= minQ; q--) {
            if (!nickFree(seq, q, j)) break;
            if (qb[p * n + q] === 0) continue;
            const e = model.interior(seq, i, j, p, q);
            if (e >= INF) continue;
            oqb[p * n + q] += outer * Math.exp(-e / RT) * scale[p - i + (j - q)];
          }
        }

        if (seq.nickBefore[j] === 0) {
          const closing = model.multiClosing(seq, i, j);
          if (closing < INF) {
            const weight = Math.exp(-closing / RT) * scale[2] * outer;
            for (let k = i + 2; k < j; k++) {
              const left = qm[(i + 1) * n + (k - 1)];
              const right = qm1[k * n + (j - 1)];
              if (right !== 0) oqm[(i + 1) * n + (k - 1)] += weight * right;
              if (left !== 0) oqm1[k * n + (j - 1)] += weight * left;
            }
          }
        }
      }

      {
        const closing = model.nickedClosing(seq, i, j);
        if (closing < INF) {
          const a = i + 1;
          const b = j - 1;
          const weight = Math.exp(-closing / RT) * scale[2] * outer;
          for (let k = a; k <= b + 1; k++) {
            if (!seq.nickBefore[k]) continue;
            const leftPart = k === a ? 1 : seq.nickBefore[a] ? 0 : dAt(a, k - 1);
            const rightPart =
              k === b + 1 ? 1 : seq.nickBefore[b + 1] ? 0 : dAt(k, b);
            // D(k, b) only enters the inside sum when it is not multiplied by
            // an identically-zero boundary factor, and likewise for D(a, k-1).
            if (k <= b && !seq.nickBefore[b + 1] && leftPart !== 0) {
              addD(k, b, weight * leftPart);
            }
            if (k > a && !seq.nickBefore[a] && rightPart !== 0) {
              addD(a, k - 1, weight * rightPart);
            }
          }
        }
      }
    }
  }

  return oqb;
}

export interface PartitionOptions {
  /** Also run the outside algorithm and return pair probabilities. */
  pairs?: boolean;
  /** Rough free energy per nucleotide used for numerical scaling. */
  scalePerBase?: number;
}

export function partitionFunction(
  seq: NickedSequence,
  model: Model,
  options: PartitionOptions = {},
): PartitionResult {
  const n = seq.n;
  if (n === 0) {
    return { logQ: 0, freeEnergy: 0, n: 0, pairProbabilities: EMPTY, unpaired: EMPTY };
  }
  const perBase = options.scalePerBase ?? defaultScale(seq, model);
  const tables = inside(seq, model, perBase);
  const raw = tables.d[0 * n + (n - 1)];
  const join = model.joinPenalty * (seq.strandCount - 1);
  // log Q with the scaling and the strand-association term folded back in.
  const logQ = Math.log(raw) + n * perBase - join / model.RT;
  const result: PartitionResult = {
    logQ,
    freeEnergy: -model.RT * logQ,
    n,
  };

  if (options.pairs) {
    const oqb = outside(seq, model, tables);
    const probabilities = new Float64Array(n * n);
    const unpaired = new Float64Array(n);
    unpaired.fill(1);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const value = (tables.qb[i * n + j] * oqb[i * n + j]) / raw;
        if (value <= 0) continue;
        const clipped = Math.min(1, value);
        probabilities[i * n + j] = clipped;
        probabilities[j * n + i] = clipped;
        unpaired[i] -= clipped;
        unpaired[j] -= clipped;
      }
    }
    for (let i = 0; i < n; i++) unpaired[i] = Math.max(0, Math.min(1, unpaired[i]));
    result.pairProbabilities = probabilities;
    result.unpaired = unpaired;
  }

  return result;
}

/**
 * A scaling exponent per nucleotide. Without it the raw sums overflow a double
 * somewhere past a few hundred nucleotides.
 */
function defaultScale(seq: NickedSequence, model: Model): number {
  if (seq.n < 120) return 0;
  // Roughly the free energy a well-paired nucleotide contributes.
  return -(-0.5) / model.RT;
}
