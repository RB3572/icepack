/**
 * Brute-force check of the partition function and pair probabilities.
 *
 * For short sequences every unpseudoknotted structure is enumerated, scored
 * with the loop-decomposition evaluator in lib/nupack/energy.ts, and summed.
 * Those sums must match the dynamic program exactly.
 */
import { MIN_HAIRPIN, encodeSequence } from "../lib/nupack/alphabet";
import { Model, makeNickedSequence, type NickedSequence } from "../lib/nupack/model";
import { structureEnergyDetailed } from "../lib/nupack/energy";
import { partitionFunction } from "../lib/nupack/pf";
import { isConnected } from "../lib/nupack/structure";

function enumerateStructures(seq: NickedSequence, model: Model): Int32Array[] {
  const n = seq.n;
  const memo = new Map<string, Array<Array<[number, number]>>>();

  const canPair = (i: number, j: number) => {
    if (model.pair(seq.bases[i], seq.bases[j]) === 0) return false;
    const nicks = seq.nickPrefix[j] - seq.nickPrefix[i];
    if (nicks > 0) return j > i;
    return j - i - 1 >= MIN_HAIRPIN;
  };

  function go(i: number, j: number): Array<Array<[number, number]>> {
    if (i > j) return [[]];
    const key = `${i},${j}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const out: Array<Array<[number, number]>> = [];
    for (const rest of go(i + 1, j)) out.push(rest);
    for (let k = i + 1; k <= j; k++) {
      if (!canPair(i, k)) continue;
      for (const inside of go(i + 1, k - 1)) {
        for (const after of go(k + 1, j)) {
          out.push([[i, k], ...inside, ...after]);
        }
      }
    }
    memo.set(key, out);
    return out;
  }

  return go(0, n - 1).map((pairs) => {
    const table = new Int32Array(n).fill(-1);
    for (const [a, b] of pairs) {
      table[a] = b;
      table[b] = a;
    }
    return table;
  });
}

interface Reference {
  logQ: number;
  freeEnergy: number;
  probabilities: Float64Array;
  count: number;
}

function brute(seq: NickedSequence, model: Model, strandLengths: number[]): Reference {
  const n = seq.n;
  let total = 0;
  const probabilities = new Float64Array(n * n);
  let count = 0;
  for (const pairs of enumerateStructures(seq, model)) {
    if (!isConnected(pairs, strandLengths)) continue;
    const { energy, connected } = structureEnergyDetailed(seq, pairs, model);
    if (!connected || !Number.isFinite(energy)) continue;
    const weight = Math.exp(-energy / model.RT);
    total += weight;
    count += 1;
    for (let i = 0; i < n; i++) {
      const partner = pairs[i];
      if (partner > i) probabilities[i * n + partner] += weight;
    }
  }
  for (let i = 0; i < n * n; i++) probabilities[i] /= total;
  return {
    logQ: Math.log(total),
    freeEnergy: -model.RT * Math.log(total),
    probabilities,
    count,
  };
}

function randomSequence(length: number, material: "rna" | "dna"): string {
  const alphabet = material === "dna" ? "ACGT" : "ACGU";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * 4)];
  }
  return out;
}

let failures = 0;

function check(label: string, strands: string[], model: Model) {
  const encoded = strands.map(encodeSequence);
  const seq = makeNickedSequence(encoded);
  const strandLengths = encoded.map((s) => s.length);
  const reference = brute(seq, model, strandLengths);
  const computed = partitionFunction(seq, model, { pairs: true });

  const dG = Math.abs(reference.freeEnergy - computed.freeEnergy);
  let maxPairError = 0;
  const probabilities = computed.pairProbabilities!;
  for (let i = 0; i < seq.n; i++) {
    for (let j = i + 1; j < seq.n; j++) {
      maxPairError = Math.max(
        maxPairError,
        Math.abs(reference.probabilities[i * seq.n + j] - probabilities[i * seq.n + j]),
      );
    }
  }
  const ok = dG < 1e-7 && maxPairError < 1e-7;
  if (!ok) failures += 1;
  const status = ok ? "ok  " : "FAIL";
  console.log(
    `${status} ${label.padEnd(34)} dG ref=${reference.freeEnergy.toFixed(6)} ` +
      `dp=${computed.freeEnergy.toFixed(6)} |diff|=${dG.toExponential(2)} ` +
      `maxP=${maxPairError.toExponential(2)} structures=${reference.count}`,
  );
}

const rna = new Model({ material: "rna", celsius: 37, ensemble: "stacking" });
const rnaPlain = new Model({ material: "rna", celsius: 37, ensemble: "nostacking" });
const dna = new Model({ material: "dna", celsius: 23, ensemble: "stacking" });

check("single GCGCAAAAGCGC", ["GCGCAAAAGCGC"], rna);
check("single nostacking", ["GCGCAAAAGCGC"], rnaPlain);
check("single DNA 23C", ["GCGCAAAAGCGC"], dna);
check("duplex GGGGAAAA+UUUUCCCC", ["GGGGAAAA", "UUUUCCCC"], rna);
check("duplex nostacking", ["GGGGAAAA", "UUUUCCCC"], rnaPlain);
check("dimer same strand", ["GCGCAAAAGCGC", "GCGCAAAAGCGC"], rna);
check("three strands", ["GGGAAA", "UUUCCC", "GGGUUU"], rna);
check("three strands DNA", ["GGGAAA", "TTTCCC", "GGGTTT"], dna);
check("short duplex", ["GGGG", "CCCC"], rna);
check("asymmetric duplex", ["AGCUUAGC", "GCUAAGCUAA"], rna);

for (let trial = 0; trial < 8; trial++) {
  check(`random rna ${trial}`, [randomSequence(13, "rna")], rna);
}
for (let trial = 0; trial < 6; trial++) {
  check(`random rna pair ${trial}`, [randomSequence(7, "rna"), randomSequence(7, "rna")], rna);
}
for (let trial = 0; trial < 4; trial++) {
  check(
    `random dna triple ${trial}`,
    [randomSequence(5, "dna"), randomSequence(5, "dna"), randomSequence(5, "dna")],
    dna,
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
