/**
 * Converts a ViennaRNA-format ".par" nearest-neighbour parameter file into the
 * compact JSON consumed by lib/nupack/params/index.ts.
 *
 * Usage: node lib/nupack/params/build-params.mjs
 *
 * The source files hold published literature parameters:
 *   rna_turner2004.par   Turner/Mathews 2004 RNA set  (NUPACK calls this rna06)
 *   dna_mathews2004.par  SantaLucia/Mathews 2004 DNA set (NUPACK calls this dna04)
 *
 * Energies in the ".par" files are integers in units of 0.01 kcal/mol; we keep
 * that integer representation so the JSON stays small and exact.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const INF = 1000000;

/** Splits the file into `# name` sections and tokenises each one. */
function readSections(text) {
  const sections = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    // Comments never span lines in this format, and dna_mathews2004.par
    // contains an unterminated "/* ... /*" that a multi-line strip would eat.
    const rawLine = line.replace(/\/\*.*?\*\//g, "").replace(/\/\*.*$/, "");
    const header = rawLine.match(/^#\s*(\S+)/);
    if (header) {
      current = header[1];
      sections.set(current, []);
      continue;
    }
    if (current === null) continue;
    sections.get(current).push(rawLine);
  }
  return sections;
}

function numbers(lines) {
  const out = [];
  for (const line of lines) {
    for (const token of line.trim().split(/\s+/)) {
      if (!token) continue;
      if (token === "INF") out.push(INF);
      else if (/^[+-]?\d+$/.test(token)) out.push(Number(token));
    }
  }
  return out;
}

/** Reshapes a flat list into nested arrays with the given dimensions. */
function reshape(flat, dims) {
  const expected = dims.reduce((a, b) => a * b, 1);
  if (flat.length !== expected) {
    throw new Error(`expected ${expected} values, found ${flat.length}`);
  }
  let index = 0;
  const build = (depth) => {
    if (depth === dims.length) return flat[index++];
    const out = new Array(dims[depth]);
    for (let i = 0; i < dims[depth]; i++) out[i] = build(depth + 1);
    return out;
  };
  return build(0);
}

/**
 * Vienna stores pair types 1..7 and bases 0..4; the leading slot of each
 * dimension is absent from the file. We pad so that table[pairType][base]
 * can be indexed directly with the same conventions Vienna uses.
 */
function padPairs(table, fill) {
  return [fill, ...table];
}

function sectionTable(sections, name, dims) {
  const lines = sections.get(name);
  if (!lines) throw new Error(`missing section ${name}`);
  return reshape(numbers(lines), dims);
}

function filled(dims, value) {
  if (dims.length === 0) return value;
  const [head, ...rest] = dims;
  return Array.from({ length: head }, () => filled(rest, value));
}

function specialLoops(lines) {
  const entries = [];
  for (const line of lines) {
    const match = line.trim().match(/^([ACGUT]+)\s+([+-]?\d+)\s+([+-]?\d+)/);
    if (match) entries.push([match[1], Number(match[2]), Number(match[3])]);
  }
  return entries;
}

function convert(sourceFile, name, material) {
  const text = readFileSync(join(HERE, "raw", sourceFile), "utf8");
  const sections = readSections(text);

  const mismatch = (key) =>
    padPairs(sectionTable(sections, key, [7, 5, 5]), filled([5, 5], INF));
  const dangle = (key) =>
    padPairs(sectionTable(sections, key, [7, 5]), filled([5], INF));

  const ml = numbers(sections.get("ML_params"));
  const ninio = numbers(sections.get("NINIO"));
  const misc = numbers(sections.get("Misc"));

  return {
    name,
    material,
    // 8x8 so index 0 (the "no pair" slot) lines up with Vienna's convention.
    stack: padPairs(
      sectionTable(sections, "stack", [7, 7]).map((row) => [INF, ...row]),
      filled([8], INF),
    ),
    stackH: padPairs(
      sectionTable(sections, "stack_enthalpies", [7, 7]).map((row) => [INF, ...row]),
      filled([8], INF),
    ),
    mismatchHairpin: mismatch("mismatch_hairpin"),
    mismatchHairpinH: mismatch("mismatch_hairpin_enthalpies"),
    mismatchInterior: mismatch("mismatch_internal"),
    mismatchInteriorH: mismatch("mismatch_internal_enthalpies"),
    mismatchInterior1n: mismatch("mismatch_internal_1n"),
    mismatchInterior1nH: mismatch("mismatch_internal_1n_enthalpies"),
    mismatchInterior23: mismatch("mismatch_internal_23"),
    mismatchInterior23H: mismatch("mismatch_internal_23_enthalpies"),
    mismatchMulti: mismatch("mismatch_multi"),
    mismatchMultiH: mismatch("mismatch_multi_enthalpies"),
    mismatchExterior: mismatch("mismatch_exterior"),
    mismatchExteriorH: mismatch("mismatch_exterior_enthalpies"),
    dangle5: dangle("dangle5"),
    dangle5H: dangle("dangle5_enthalpies"),
    dangle3: dangle("dangle3"),
    dangle3H: dangle("dangle3_enthalpies"),
    int11: padPairs(
      sectionTable(sections, "int11", [7, 7, 5, 5]).map((row) => [filled([5, 5], INF), ...row]),
      filled([8, 5, 5], INF),
    ),
    int11H: padPairs(
      sectionTable(sections, "int11_enthalpies", [7, 7, 5, 5]).map((row) => [
        filled([5, 5], INF),
        ...row,
      ]),
      filled([8, 5, 5], INF),
    ),
    int21: padPairs(
      sectionTable(sections, "int21", [7, 7, 5, 5, 5]).map((row) => [
        filled([5, 5, 5], INF),
        ...row,
      ]),
      filled([8, 5, 5, 5], INF),
    ),
    int21H: padPairs(
      sectionTable(sections, "int21_enthalpies", [7, 7, 5, 5, 5]).map((row) => [
        filled([5, 5, 5], INF),
        ...row,
      ]),
      filled([8, 5, 5, 5], INF),
    ),
    // int22 omits the NN pair type and the N base, so pad both ends.
    int22: padInt22(sectionTable(sections, "int22", [6, 6, 4, 4, 4, 4])),
    int22H: padInt22(sectionTable(sections, "int22_enthalpies", [6, 6, 4, 4, 4, 4])),
    hairpin: numbers(sections.get("hairpin")),
    hairpinH: numbers(sections.get("hairpin_enthalpies")),
    bulge: numbers(sections.get("bulge")),
    bulgeH: numbers(sections.get("bulge_enthalpies")),
    interior: numbers(sections.get("internal")),
    interiorH: numbers(sections.get("internal_enthalpies")),
    multiBase: ml[0],
    multiBaseH: ml[1],
    multiClosing: ml[2],
    multiClosingH: ml[3],
    multiIntern: ml[4],
    multiInternH: ml[5],
    ninio: ninio[0],
    ninioH: ninio[1],
    ninioMax: ninio[2],
    joinPenalty: misc[0],
    joinPenaltyH: misc[1],
    terminalAU: misc[2],
    terminalAUH: misc[3],
    tetraloops: specialLoops(sections.get("Tetraloops") ?? []),
    triloops: specialLoops(sections.get("Triloops") ?? []),
    hexaloops: specialLoops(sections.get("Hexaloops") ?? []),
  };
}

function padInt22(table) {
  // file order is pair 1..6, base 1..4 -> index so [pair][pair][b][b][b][b]
  const byPair = table.map((outer) => [
    filled([5, 5, 5, 5], INF),
    ...outer.map((inner) => [
      filled([5, 5, 5], INF),
      ...inner.map((a) => [filled([5, 5], INF), ...a.map((b) => [filled([5], INF), ...b.map((c) => [INF, ...c])])]),
    ]),
    filled([5, 5, 5, 5], INF),
  ]);
  return [filled([8, 5, 5, 5, 5], INF), ...byPair, filled([8, 5, 5, 5, 5], INF)];
}

for (const [file, name, material] of [
  ["rna_turner2004.par", "rna06", "rna"],
  ["dna_mathews2004.par", "dna04", "dna"],
]) {
  const data = convert(file, name, material);
  writeFileSync(join(HERE, `${name}.json`), JSON.stringify(data));
  console.log(`wrote ${name}.json`);
}
