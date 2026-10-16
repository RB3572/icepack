import { runDesign, type DesignJob } from "../lib/nupack/design";

const job: DesignJob = {
  model: { material: "rna", celsius: 37, ensemble: "stacking", sodium: 1, magnesium: 0 },
  domains: [
    { name: "stem", constraint: "N".repeat(10) },
    { name: "loop", constraint: "N".repeat(6) },
  ],
  strands: [{ name: "h", domains: ["stem", "loop", "stem*"] }],
  complexes: [{ name: "hairpin", strands: ["h"], structure: "D10(U6)" }],
  tubes: [{ name: "Tube", onTargets: [{ complex: "hairpin", concentration: 1e-6 }], maxComplexSize: 2 }],
  stopCondition: 0.02,
  maxTime: 45,
  seed: 7,
  trials: 1,
};

const t0 = Date.now();
const result = runDesign(job, "multitube");
console.log(`multitube defect=${result.defect.toFixed(5)} met=${result.stopConditionMet} mutations=${result.mutations} ${((Date.now()-t0)/1000).toFixed(1)}s`);
for (const s of result.strands) console.log(`  ${s.name}: ${s.sequence}`);
for (const c of result.complexes) console.log(`  ${c.name}: n=${c.ensembleDefect.toFixed(3)} (${(c.normalizedDefect*100).toFixed(1)}%) p=${c.probability.toFixed(3)} dG=${c.structureFreeEnergy.toFixed(2)}`);
for (const t of result.tubes) { console.log(`  tube ${t.name} defect=${t.defect.toFixed(4)}`); for (const c of t.complexes) console.log(`    ${c.name}: ${(c.concentration*1e6).toFixed(3)} uM (target ${(c.target*1e6).toFixed(3)} uM)`); }

// cheaper single-complex objective on the problem set's stick figure
const stick = "..((((((((..((((((((((...))))))(((.........)))((((((...))))))))))..((((((((...)))))))))))))))).";
const job2: DesignJob = {
  model: { material: "rna", celsius: 23, ensemble: "stacking", sodium: 1, magnesium: 0 },
  domains: [{ name: "d", constraint: "N".repeat(stick.length) }],
  strands: [{ name: "s", domains: ["d"] }],
  complexes: [{ name: "stick", strands: ["s"], structure: stick }],
  tubes: [],
  stopCondition: 0.01,
  maxTime: 90,
  seed: 163,
  trials: 1,
};
const t1 = Date.now();
const r2 = runDesign(job2, "ensemble");
console.log(`\nstick figure: defect=${r2.defect.toFixed(5)} met=${r2.stopConditionMet} mutations=${r2.mutations} ${((Date.now()-t1)/1000).toFixed(1)}s`);
console.log(`  ${r2.strands[0].sequence}`);
const c = r2.complexes[0];
console.log(`  n=${c.ensembleDefect.toFixed(3)} (${(c.normalizedDefect*100).toFixed(2)}%) p=${c.probability.toFixed(3)} dG=${c.structureFreeEnergy.toFixed(2)} mfeDefect=${c.mfeDefect}`);
