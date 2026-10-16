import { parseStructure, formatStructure, normalizeStructure } from "../lib/nupack/structure";
const cases = [
  "D10(U6)",
  "D18(U6+)",
  "((((((((((((((((+))))))))((((((((+))))))))))))))))",
  "(4.4)4",
  "..((((((((..((((((((((...))))))(((.........)))((((((...))))))))))..((((((((...)))))))))))))))).",
];
for (const c of cases) {
  const plain = normalizeStructure(c);
  const p = parseStructure(c);
  console.log(`${c}\n  -> ${plain}\n  -> n=${p.n} strands=${p.strandLengths.join("/")} round-trip=${formatStructure(p.pairs, p.strandLengths)}`);
}
