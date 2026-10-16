import { encodeSequence } from "../lib/nupack/alphabet";
import { Model, makeNickedSequence } from "../lib/nupack/model";
import { ensembleSize } from "../lib/nupack/ensemble";

const dnaNo = new Model({ material: "dna", celsius: 37, ensemble: "nostacking" });
let bad = 0;
for (const [s, expected] of [["ATAGTTTTCTCGAAAACGAT", 2349], ["CGAGATACCTCGATCACGCG", 971]] as Array<[string, number]>) {
  const r = ensembleSize(makeNickedSequence([encodeSequence(s)]), dnaNo);
  const ok = r.count === expected;
  if (!ok) bad++;
  console.log(`${s} -> ${r.count} (expected ${expected}) ${ok ? "ok" : "MISMATCH"}`);
}
// a duplex ensemble: counts must stay finite and sane
const duplex = ensembleSize(makeNickedSequence([encodeSequence("GGGGAAAA"), encodeSequence("TTTTCCCC")]), dnaNo);
console.log("duplex ensemble size:", duplex.count);
process.exit(bad === 0 ? 0 : 1);
