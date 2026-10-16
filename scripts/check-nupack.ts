import { encodeSequence } from "../lib/nupack/alphabet";
import { Model, makeNickedSequence } from "../lib/nupack/model";
import { structureEnergy } from "../lib/nupack/energy";
import { partitionFunction } from "../lib/nupack/pf";
import { parseStructure } from "../lib/nupack/structure";

const seqText = "GCCGGUGCUGUUAUAUGCCUCAGCACCGGCAUAUAACAGC";
const structText = "((((((((((..........))))))))))..........";
const encoded = encodeSequence(seqText);
const seq = makeNickedSequence([encoded]);
const parsed = parseStructure(structText);

for (const ensemble of ["stacking", "nostacking"] as const) {
  const model = new Model({ material: "rna", celsius: 37, ensemble });
  const pf = partitionFunction(seq, model, { pairs: true });
  const e = structureEnergy(seq, parsed.pairs, model);
  const p = Math.exp(-(e - pf.freeEnergy) / model.RT);
  // ensemble defect n = N - sum_ij P_ij S_ij  (S includes the unpaired column)
  const n = seq.n;
  let overlap = 0;
  for (let i = 0; i < n; i++) {
    const partner = parsed.pairs[i];
    if (partner < 0) overlap += pf.unpaired![i];
    else overlap += pf.pairProbabilities![i * n + partner];
  }
  const defect = n - overlap;
  console.log(
    `${ensemble.padEnd(11)} complexG=${pf.freeEnergy.toFixed(2)} structG=${e.toFixed(2)} p=${p.toFixed(3)} defect=${defect.toFixed(2)} (${((defect / n) * 100).toFixed(2)}%)`,
  );
}
console.log("NUPACK      complexG=-21.38 structG=-21.14 p=0.676 defect=11.90 (30.00%)");
