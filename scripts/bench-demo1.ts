import { encodeSequence } from "../lib/nupack/alphabet";
import { analyzeJob, meltProfile, type JobSpec } from "../lib/nupack/analysis";

const A = "GCTTGAGATGTTAGGGAGTAGTGCTCCAATCACAACGCACTACTCCCTAACATC";
const B = "AGGGAGTAGTGCGTTGTGATTGGAAACATCTCAAGCTCCAATCACAACGCACTA";
const C = "GTTGTGATTGGAGCTTGAGATGTTGCACTACTCCCTAACATCTCAAGCTCCAAT";

const spec: JobSpec = {
  model: { material: "dna", celsius: 37, ensemble: "stacking", sodium: 1, magnesium: 0 },
  species: [
    { name: "A", sequence: encodeSequence(A) },
    { name: "B", sequence: encodeSequence(B) },
    { name: "C", sequence: encodeSequence(C) },
  ],
  tubes: [{ name: "Demo", concentrations: [750e-9, 750e-9, 750e-9], maxComplexSize: 3 }],
};

let t0 = Date.now();
const one = analyzeJob(spec, 50);
console.log(`single temperature: ${Date.now() - t0} ms`);
console.log("50 C top complexes:");
for (const entry of one.tubes[0].complexes.slice(0, 6)) {
  console.log(`  ${entry.id.name.padEnd(8)} ${(entry.concentration * 1e9).toFixed(1).padStart(8)} nM   dG=${entry.freeEnergy.toFixed(2)}`);
}
console.log("fraction unpaired:", one.tubes[0].fractionUnpaired.toFixed(4));

t0 = Date.now();
const melt = meltProfile(spec, { min: 35, max: 95, step: 5 });
console.log(`\nmelt (13 points): ${Date.now() - t0} ms`);
for (const point of melt.points) {
  console.log(`  ${point.celsius.toFixed(0).padStart(3)} C  ${point.fractionUnpaired[0].toFixed(4)}`);
}
