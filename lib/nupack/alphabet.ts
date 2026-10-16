/**
 * Nucleotide encoding shared by the whole engine.
 *
 * Bases are encoded 0..4 where 0 is the "any/none" slot used at sequence
 * boundaries and across nicks; 1..4 are A, C, G, U (T is folded onto U so a
 * single set of tables serves both materials).
 *
 * Pair types follow the convention of the published parameter tables:
 *   1 CG   2 GC   3 GU   4 UG   5 AU   6 UA   7 NN (unspecified)
 */

export const BASE_NONE = 0;
export const BASE_A = 1;
export const BASE_C = 2;
export const BASE_G = 3;
export const BASE_U = 4;

export const BASE_LETTERS = ["N", "A", "C", "G", "U"] as const;

export type Material = "rna" | "dna" | "2ome-rna";

/** Letter used when rendering a sequence back to text. */
export function baseLetter(base: number, material: Material): string {
  if (base === BASE_U) return material === "dna" ? "T" : "U";
  return BASE_LETTERS[base] ?? "N";
}

export function encodeBase(letter: string): number {
  switch (letter.toUpperCase()) {
    case "A":
      return BASE_A;
    case "C":
      return BASE_C;
    case "G":
      return BASE_G;
    case "U":
    case "T":
      return BASE_U;
    default:
      return BASE_NONE;
  }
}

/** Degenerate IUPAC codes, used for sequence constraints during design. */
const IUPAC: Record<string, number[]> = {
  A: [BASE_A],
  C: [BASE_C],
  G: [BASE_G],
  T: [BASE_U],
  U: [BASE_U],
  R: [BASE_A, BASE_G],
  Y: [BASE_C, BASE_U],
  S: [BASE_C, BASE_G],
  W: [BASE_A, BASE_U],
  K: [BASE_G, BASE_U],
  M: [BASE_A, BASE_C],
  B: [BASE_C, BASE_G, BASE_U],
  D: [BASE_A, BASE_G, BASE_U],
  H: [BASE_A, BASE_C, BASE_U],
  V: [BASE_A, BASE_C, BASE_G],
  N: [BASE_A, BASE_C, BASE_G, BASE_U],
};

export function expandCode(letter: string): number[] | null {
  return IUPAC[letter.toUpperCase()] ?? null;
}

export function encodeSequence(sequence: string): number[] {
  const out: number[] = [];
  for (const letter of sequence) {
    if (/\s/.test(letter)) continue;
    out.push(encodeBase(letter));
  }
  return out;
}

export function decodeSequence(bases: number[], material: Material = "rna"): string {
  return bases.map((base) => baseLetter(base, material)).join("");
}

const PAIR_TABLE: number[][] = [
  //      N  A  C  G  U
  /* N */ [0, 0, 0, 0, 0],
  /* A */ [0, 0, 0, 0, 5],
  /* C */ [0, 0, 0, 1, 0],
  /* G */ [0, 0, 2, 0, 3],
  /* U */ [0, 6, 0, 4, 0],
];

/** 0 when the two bases cannot pair, otherwise the pair type 1..6. */
export function pairType(a: number, b: number): number {
  return PAIR_TABLE[a]?.[b] ?? 0;
}

/** The same pair read from the other side: CG <-> GC, GU <-> UG, AU <-> UA. */
export const REVERSE_TYPE = [0, 2, 1, 4, 3, 6, 5, 7];

/** Watson-Crick complement, used when generating structure-compatible sequences. */
export function complement(base: number, material: Material = "rna"): number {
  void material;
  switch (base) {
    case BASE_A:
      return BASE_U;
    case BASE_U:
      return BASE_A;
    case BASE_C:
      return BASE_G;
    case BASE_G:
      return BASE_C;
    default:
      return BASE_NONE;
  }
}

export const WATSON_CRICK_PAIRS: Array<[number, number]> = [
  [BASE_A, BASE_U],
  [BASE_U, BASE_A],
  [BASE_C, BASE_G],
  [BASE_G, BASE_C],
];

export const WOBBLE_PAIRS: Array<[number, number]> = [
  [BASE_G, BASE_U],
  [BASE_U, BASE_G],
];

/** Minimum number of unpaired bases enclosed by a hairpin loop. */
export const MIN_HAIRPIN = 3;
