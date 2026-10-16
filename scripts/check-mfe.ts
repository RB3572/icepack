import { MIN_HAIRPIN, encodeSequence } from "../lib/nupack/alphabet";
import { Model, makeNickedSequence, type NickedSequence } from "../lib/nupack/model";
import { structureEnergyDetailed } from "../lib/nupack/energy";
import { mfe } from "../lib/nupack/mfe";
import { partitionFunction } from "../lib/nupack/pf";
import { isConnected, formatStructure, parseStructure } from "../lib/nupack/structure";
import { structureEnergy } from "../lib/nupack/energy";
import { ensembleSize } from "../lib/nupack/ensemble";

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
    const c = memo.get(key); if (c) return c;
    const out: Array<Array<[number, number]>> = [];
    for (const rest of go(i + 1, j)) out.push(rest);
    for (let k = i + 1; k <= j; k++) {
      if (!canPair(i, k)) continue;
      for (const inside of go(i + 1, k - 1)) for (const after of go(k + 1, j)) out.push([[i, k], ...inside, ...after]);
    }
    memo.set(key, out); return out;
  }
  return go(0, n - 1).map((pairs) => {
    const t = new Int32Array(n).fill(-1);
    for (const [a, b] of pairs) { t[a] = b; t[b] = a; }
    return t;
  });
}

let fails = 0;
function checkMfe(label: string, strands: string[], model: Model) {
  const encoded = strands.map(encodeSequence);
  const seq = makeNickedSequence(encoded);
  const lens = encoded.map(s => s.length);
  let best = Infinity;
  for (const pairs of enumerateStructures(seq, model)) {
    if (!isConnected(pairs, lens)) continue;
    const { energy, connected } = structureEnergyDetailed(seq, pairs, model);
    if (!connected || !Number.isFinite(energy)) continue;
    if (energy < best) best = energy;
  }
  const got = mfe(seq, model);
  const recomputed = structureEnergy(seq, got.pairs, model);
  const ok = Math.abs(best - got.energy) < 1e-9 && Math.abs(recomputed - got.energy) < 1e-9;
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(26)} brute=${best.toFixed(6)} dp=${got.energy.toFixed(6)} traceback=${recomputed.toFixed(6)} ${formatStructure(got.pairs, lens)}`);
}

const rna = new Model({ material: "rna", celsius: 37, ensemble: "stacking" });
const dna23 = new Model({ material: "dna", celsius: 23, ensemble: "stacking" });
const alpha = "ACGU";
checkMfe("GCGCAAAAGCGC", ["GCGCAAAAGCGC"], rna);
checkMfe("duplex", ["GGGGAAAA", "UUUUCCCC"], rna);
checkMfe("three strands", ["GGGAAA", "UUUCCC", "GGGUUU"], rna);
for (let t = 0; t < 10; t++) checkMfe(`random ${t}`, [Array.from({length:14},()=>alpha[Math.floor(Math.random()*4)]).join("")], rna);
for (let t = 0; t < 6; t++) checkMfe(`random pair ${t}`, [Array.from({length:8},()=>alpha[Math.floor(Math.random()*4)]).join(""), Array.from({length:7},()=>alpha[Math.floor(Math.random()*4)]).join("")], rna);

console.log("\n--- NUPACK reference values (DNA, 23 C) ---");
const I1 = "CCACACCACAACAACCACATCTCG";
const d1h1 = "CGAGATGTGGTTGTTGTGGTGTGGATACAACCACACCACAACAACCAC";
const d1h2 = "CCACACCACAACAACCACATCTCGGTGGTTGTTGTGGTGTGGTTGTAT";
const d2h1 = "CGAGATGTGGTTGTTGTGGTGTGGGTGGTTCCACACCACAACAACCAC";
const d2h2 = "CCACACCACAACAACCACATCTCGGTGGTTGTTGTGGTGTGGAACCAC";
const cases: Array<[string, string[], number]> = [
  ["I1", [I1], 0.00],
  ["D1 H1", [d1h1], -28.46],
  ["D1 H2", [d1h2], -28.10],
  ["D2 H1", [d2h1], -28.03],
  ["D2 H2", [d2h2], -28.44],
  ["D1 I1+H1", [I1, d1h1], -41.95],
  ["D2 I1+H1", [I1, d2h1], -47.31],
  ["D1 I1+H1+H2", [I1, d1h1, d1h2], -84.09],
  ["D2 I1+H1+H2", [I1, d2h1, d2h2], -84.55],
];
for (const [label, strands, expected] of cases) {
  const encoded = strands.map(encodeSequence);
  const seq = makeNickedSequence(encoded);
  const got = mfe(seq, dna23);
  console.log(`${label.padEnd(13)} ours=${got.energy.toFixed(2).padStart(8)} nupack=${expected.toFixed(2).padStart(8)} diff=${(got.energy-expected).toFixed(2)}`);
}

console.log("\n--- RNA 23 C structure energies ---");
const seq40 = "GCCGGUGCUGUUAUAUGCCUCAGCACCGGCAUAUAACAGC";
const rna23 = new Model({ material: "rna", celsius: 23, ensemble: "stacking" });
const s1 = "((((((((((..........))))))))))..........";
const s2 = "......(((((((((((((........)))))))))))))";
const nseq = makeNickedSequence([encodeSequence(seq40)]);
const pf = partitionFunction(nseq, rna23, { pairs: true });
const pairsToCheck: Array<[string, string, number]> = [["s1", s1, -25.79], ["s2", s2, -25.80]];
for (const [label, st, expected] of pairsToCheck) {
  const p = parseStructure(st);
  const e = structureEnergy(nseq, p.pairs, rna23);
  const prob = Math.exp(-(e - pf.freeEnergy) / rna23.RT);
  console.log(`${label} ours=${e.toFixed(2)} nupack=${expected.toFixed(2)} p=${prob.toFixed(4)} (nupack ~0.49)`);
}
console.log("\n--- ensemble size ---");
const dnaNoStack = new Model({ material: "dna", celsius: 37, ensemble: "nostacking" });
for (const [s, expected] of [["ATAGTTTTCTCGAAAACGAT", 2349], ["CGAGATACCTCGATCACGCG", 971]] as Array<[string, number]>) {
  const r = ensembleSize(makeNickedSequence([encodeSequence(s)]), dnaNoStack);
  console.log(`${s} -> ${r.count} (expected ${expected}) ${r.count === expected ? "ok" : "MISMATCH"}`);
}

process.exit(fails === 0 ? 0 : 1);
