/**
 * The nearest-neighbour free energy model.
 *
 * Loop energies follow the standard decomposition of an unpseudoknotted
 * secondary structure into hairpin, interior (stack/bulge/internal), multi and
 * exterior loops, evaluated with the published Turner/SantaLucia 2004 tables
 * (see params/build-params.mjs). Temperature dependence comes from the paired
 * enthalpy tables via dG(T) = dH - (dH - dG37) * T / T37.
 *
 * Multi-strand complexes are represented as one concatenated sequence carrying
 * nick positions. Any loop whose unpaired regions span a nick is not a real
 * loop at all - it is part of the exterior loop - and is scored accordingly.
 */
import {
  BASE_NONE,
  type Material,
  REVERSE_TYPE,
  baseLetter,
  pairType,
} from "./alphabet";
import rna06 from "./params/rna06.json";
import dna04 from "./params/dna04.json";

export const INF = 1e6;
export const MAXLOOP = 30;
const LXC37 = 107.856;
const T37 = 310.15;
const KELVIN = 273.15;
/** kcal/(mol*K) */
export const GAS_CONSTANT = 0.0019872;

type RawParams = typeof rna06;

export type EnsembleName =
  | "stacking"
  | "nostacking"
  | "coaxial"
  | "dangles"
  | "some-nupack3"
  | "none-nupack3"
  | "all-nupack3";

export const ENSEMBLE_LABELS: Record<EnsembleName, string> = {
  stacking: "All stacking",
  nostacking: "No stacking",
  coaxial: "Coaxial stacking",
  dangles: "Dangle stacking",
  "some-nupack3": "Some dangles (NUPACK3)",
  "none-nupack3": "No dangles (NUPACK3)",
  "all-nupack3": "All dangles (NUPACK3)",
};

/** Terminal-mismatch/dangle treatment implied by each ensemble name. */
function danglesLevel(ensemble: EnsembleName): 0 | 2 {
  switch (ensemble) {
    case "nostacking":
    case "none-nupack3":
      return 0;
    default:
      return 2;
  }
}

export interface ModelSpec {
  material: Material;
  celsius: number;
  ensemble: EnsembleName;
  /** Na+ concentration in molar; only affects DNA. */
  sodium: number;
  /** Mg++ concentration in molar; only affects DNA. */
  magnesium: number;
  parameterSet?: string;
  /**
   * Allow G.U (G.T) wobble pairs. The RNA tables treat them as canonical; the
   * DNA nearest-neighbour model treats G.T as a mismatch, so it defaults off
   * for DNA.
   */
  wobble?: boolean;
}

export const DEFAULT_MODEL: ModelSpec = {
  material: "rna",
  celsius: 37,
  ensemble: "stacking",
  sodium: 1,
  magnesium: 0,
};

/** A concatenated multi-strand sequence with the nick positions marked. */
export interface NickedSequence {
  bases: Uint8Array;
  n: number;
  /** nickBefore[i] is 1 when a strand boundary sits between i-1 and i. */
  nickBefore: Uint8Array;
  /** nickPrefix[i] = number of nicks at positions <= i. */
  nickPrefix: Int32Array;
  /** Index of the strand each base belongs to. */
  strandOf: Int32Array;
  strandCount: number;
}

export function makeNickedSequence(strands: number[][]): NickedSequence {
  const n = strands.reduce((sum, s) => sum + s.length, 0);
  const bases = new Uint8Array(n);
  const nickBefore = new Uint8Array(n + 1);
  const strandOf = new Int32Array(n);
  let index = 0;
  strands.forEach((strand, strandIndex) => {
    if (index > 0) nickBefore[index] = 1;
    for (const base of strand) {
      bases[index] = base;
      strandOf[index] = strandIndex;
      index += 1;
    }
  });
  const nickPrefix = new Int32Array(n + 1);
  let running = 0;
  for (let i = 0; i <= n; i++) {
    running += nickBefore[i];
    nickPrefix[i] = running;
  }
  return { bases, n, nickBefore, nickPrefix, strandOf, strandCount: strands.length };
}

/** True when no strand boundary lies strictly between positions a and b. */
export function nickFree(seq: NickedSequence, a: number, b: number): boolean {
  if (b <= a) return true;
  const before = a < 0 ? 0 : seq.nickPrefix[a];
  return seq.nickPrefix[Math.min(b, seq.n)] === before;
}

function scale(dG37: number, dH: number, tempRatio: number): number {
  if (dG37 >= INF || dH >= INF) return INF;
  return (dH - (dH - dG37) * tempRatio) / 100;
}

function scaleTable(dG: unknown, dH: unknown, tempRatio: number): unknown {
  if (typeof dG === "number") return scale(dG, dH as number, tempRatio);
  return (dG as unknown[]).map((entry, index) =>
    scaleTable(entry, (dH as unknown[])[index], tempRatio),
  );
}

type Table1 = number[];
type Table2 = number[][];
type Table3 = number[][][];
type Table4 = number[][][][];
type Table5 = number[][][][][];
type Table6 = number[][][][][][];

export class Model {
  readonly spec: ModelSpec;
  readonly material: Material;
  readonly temperature: number;
  readonly RT: number;
  readonly dangles: 0 | 2;
  readonly parameterName: string;
  readonly wobble: boolean;

  private readonly stackT: Table2;
  private readonly mismatchHairpinT: Table3;
  private readonly mismatchInteriorT: Table3;
  private readonly mismatchInterior1nT: Table3;
  private readonly mismatchInterior23T: Table3;
  private readonly mismatchMultiT: Table3;
  private readonly mismatchExteriorT: Table3;
  private readonly dangle5T: Table2;
  private readonly dangle3T: Table2;
  private readonly int11T: Table4;
  private readonly int21T: Table5;
  private readonly int22T: Table6;
  private readonly hairpinT: Table1;
  private readonly bulgeT: Table1;
  private readonly interiorT: Table1;
  private readonly special: Map<string, number>;

  readonly multiBase: number;
  readonly multiClosingTerm: number;
  readonly multiIntern: number;
  readonly ninio: number;
  readonly ninioMax: number;
  readonly terminalAU: number;
  readonly joinPenalty: number;
  readonly lxc: number;
  /** Per-base-pair salt correction (0 at 1 M Na+, DNA only). */
  readonly saltPerPair: number;

  constructor(spec: Partial<ModelSpec> = {}) {
    const full: ModelSpec = { ...DEFAULT_MODEL, ...spec };
    this.spec = full;
    this.material = full.material;
    this.temperature = full.celsius + KELVIN;
    this.RT = GAS_CONSTANT * this.temperature;
    this.dangles = danglesLevel(full.ensemble);
    this.wobble = full.wobble ?? full.material !== "dna";

    const raw: RawParams = (full.material === "dna" ? dna04 : rna06) as RawParams;
    this.parameterName = full.parameterSet ?? raw.name;
    const ratio = this.temperature / T37;

    const s2 = (g: unknown, h: unknown) => scaleTable(g, h, ratio) as Table2;
    const s3 = (g: unknown, h: unknown) => scaleTable(g, h, ratio) as Table3;

    this.stackT = s2(raw.stack, raw.stackH);
    this.mismatchHairpinT = s3(raw.mismatchHairpin, raw.mismatchHairpinH);
    this.mismatchInteriorT = s3(raw.mismatchInterior, raw.mismatchInteriorH);
    this.mismatchInterior1nT = s3(raw.mismatchInterior1n, raw.mismatchInterior1nH);
    this.mismatchInterior23T = s3(raw.mismatchInterior23, raw.mismatchInterior23H);
    this.mismatchMultiT = s3(raw.mismatchMulti, raw.mismatchMultiH);
    this.mismatchExteriorT = s3(raw.mismatchExterior, raw.mismatchExteriorH);
    this.dangle5T = s2(raw.dangle5, raw.dangle5H);
    this.dangle3T = s2(raw.dangle3, raw.dangle3H);
    this.int11T = scaleTable(raw.int11, raw.int11H, ratio) as Table4;
    this.int21T = scaleTable(raw.int21, raw.int21H, ratio) as Table5;
    this.int22T = scaleTable(raw.int22, raw.int22H, ratio) as Table6;
    this.hairpinT = scaleTable(raw.hairpin, raw.hairpinH, ratio) as Table1;
    this.bulgeT = scaleTable(raw.bulge, raw.bulgeH, ratio) as Table1;
    this.interiorT = scaleTable(raw.interior, raw.interiorH, ratio) as Table1;

    this.multiBase = scale(raw.multiBase, raw.multiBaseH, ratio);
    this.multiClosingTerm = scale(raw.multiClosing, raw.multiClosingH, ratio);
    this.multiIntern = scale(raw.multiIntern, raw.multiInternH, ratio);
    this.ninio = scale(raw.ninio, raw.ninioH, ratio);
    this.ninioMax = raw.ninioMax / 100;
    this.terminalAU = scale(raw.terminalAU, raw.terminalAUH, ratio);
    // Strand-association penalty, charged once per additional strand, taken
    // from the parameter set's own duplex-initiation term so the decomposition
    // stays internally consistent.
    this.joinPenalty = scale(raw.joinPenalty, raw.joinPenaltyH, ratio);
    this.lxc = (LXC37 * ratio) / 100;

    this.special = new Map();
    for (const group of [raw.tetraloops, raw.triloops, raw.hexaloops]) {
      for (const [seq, dG, dH] of group as Array<[string, number, number]>) {
        this.special.set(seq, scale(dG, dH, ratio));
      }
    }

    // NUPACK applies an empirical salt correction to DNA only; it vanishes at
    // the 1 M Na+ reference condition used by the published tables.
    if (full.material === "dna") {
      const effective = full.sodium + 3.3 * Math.sqrt(Math.max(full.magnesium, 0));
      this.saltPerPair =
        effective > 0 ? -0.114 * ratio * Math.log(effective) : 0;
    } else {
      this.saltPerPair = 0;
    }
  }

  /** Pair type of two bases under this model, or 0 when they cannot pair. */
  pair(a: number, b: number): number {
    const type = pairType(a, b);
    if (!this.wobble && (type === 3 || type === 4)) return 0;
    return type;
  }

  /** Terminal AU/GU penalty for a helix end of the given pair type. */
  terminal(type: number): number {
    return type > 2 ? this.terminalAU : 0;
  }

  private loopExtrapolate(table: Table1, size: number): number {
    if (size <= MAXLOOP) return table[size];
    return table[MAXLOOP] + this.lxc * Math.log(size / MAXLOOP);
  }

  /** Hairpin loop closed by (i, j); caller guarantees the loop holds no nick. */
  hairpin(seq: NickedSequence, i: number, j: number): number {
    const size = j - i - 1;
    const type = this.pair(seq.bases[i], seq.bases[j]);
    if (type === 0) return INF;
    let energy = this.loopExtrapolate(this.hairpinT, size);
    if (size === 3 || size === 4 || size === 6) {
      const key = this.specialKey(seq, i, size);
      const bonus = key !== null ? this.special.get(key) : undefined;
      if (bonus !== undefined) return bonus + this.saltPerPair;
    }
    if (size === 3) {
      return energy + this.terminal(type) + this.saltPerPair;
    }
    energy += this.mismatchHairpinT[type][seq.bases[i + 1]][seq.bases[j - 1]];
    return energy + this.saltPerPair;
  }

  private specialKey(seq: NickedSequence, i: number, size: number): string | null {
    const length = size + 2;
    if (i + length > seq.n) return null;
    let key = "";
    for (let k = i; k < i + length; k++) key += baseLetter(seq.bases[k], "rna");
    return key;
  }

  /**
   * Interior loop (stack, bulge or internal loop) closed by (i, j) with the
   * single enclosed pair (p, q); caller guarantees neither side spans a nick.
   */
  interior(
    seq: NickedSequence,
    i: number,
    j: number,
    p: number,
    q: number,
  ): number {
    const s = seq.bases;
    const type = this.pair(s[i], s[j]);
    const type2 = this.pair(s[q], s[p]);
    if (type === 0 || type2 === 0) return INF;
    const n1 = p - i - 1;
    const n2 = j - q - 1;
    const nl = Math.max(n1, n2);
    const ns = Math.min(n1, n2);
    const salt = this.saltPerPair;

    if (nl === 0) return this.stackT[type][type2] + salt;

    if (ns === 0) {
      let energy = this.loopExtrapolate(this.bulgeT, nl);
      if (nl === 1) energy += this.stackT[type][type2];
      else energy += this.terminal(type) + this.terminal(type2);
      return energy + salt;
    }

    const si1 = s[i + 1];
    const sj1 = s[j - 1];
    const sp1 = s[p - 1];
    const sq1 = s[q + 1];

    if (ns === 1) {
      if (nl === 1) return this.int11T[type][type2][si1][sj1] + salt;
      if (nl === 2) {
        const energy =
          n1 === 1
            ? this.int21T[type][type2][si1][sq1][sj1]
            : this.int21T[type2][type][sq1][si1][sp1];
        return energy + salt;
      }
      let energy = this.loopExtrapolate(this.interiorT, nl + 1);
      energy += Math.min(this.ninioMax, (nl - ns) * this.ninio);
      energy +=
        this.mismatchInterior1nT[type][si1][sj1] +
        this.mismatchInterior1nT[type2][sq1][sp1];
      return energy + salt;
    }

    if (ns === 2) {
      if (nl === 2) return this.int22T[type][type2][si1][sp1][sq1][sj1] + salt;
      if (nl === 3) {
        const energy =
          this.interiorT[5] +
          this.ninio +
          this.mismatchInterior23T[type][si1][sj1] +
          this.mismatchInterior23T[type2][sq1][sp1];
        return energy + salt;
      }
    }

    let energy = this.loopExtrapolate(this.interiorT, nl + ns);
    energy += Math.min(this.ninioMax, (nl - ns) * this.ninio);
    energy +=
      this.mismatchInteriorT[type][si1][sj1] +
      this.mismatchInteriorT[type2][sq1][sp1];
    return energy + salt;
  }

  /**
   * Energy contributed by a helix end that opens into an exterior or multi
   * loop. `left` and `right` are the flanking bases in that loop, or
   * BASE_NONE where the loop runs off the end of a strand.
   */
  private stemTerm(
    type: number,
    left: number,
    right: number,
    multi: boolean,
  ): number {
    let energy = 0;
    if (this.dangles === 2) {
      const table = multi ? this.mismatchMultiT : this.mismatchExteriorT;
      if (left !== BASE_NONE && right !== BASE_NONE) {
        energy += table[type][left][right];
      } else if (left !== BASE_NONE) {
        energy += this.dangle5T[type][left];
      } else if (right !== BASE_NONE) {
        energy += this.dangle3T[type][right];
      }
    }
    energy += this.terminal(type);
    if (multi) energy += this.multiIntern;
    return energy;
  }

  /** Base 5' of position i within the same strand, else BASE_NONE. */
  private base5(seq: NickedSequence, i: number): number {
    if (i <= 0 || seq.nickBefore[i]) return BASE_NONE;
    return seq.bases[i - 1];
  }

  /** Base 3' of position i within the same strand, else BASE_NONE. */
  private base3(seq: NickedSequence, i: number): number {
    if (i >= seq.n - 1 || seq.nickBefore[i + 1]) return BASE_NONE;
    return seq.bases[i + 1];
  }

  /** Cost of a branch (d, e) sitting in an exterior loop. */
  exteriorBranch(seq: NickedSequence, d: number, e: number): number {
    const type = this.pair(seq.bases[d], seq.bases[e]);
    if (type === 0) return INF;
    return this.stemTerm(type, this.base5(seq, d), this.base3(seq, e), false);
  }

  /** Cost of a branch (d, e) sitting in a multiloop (includes the branch term). */
  multiBranch(seq: NickedSequence, d: number, e: number): number {
    const type = this.pair(seq.bases[d], seq.bases[e]);
    if (type === 0) return INF;
    return this.stemTerm(type, this.base5(seq, d), this.base3(seq, e), true);
  }

  /** Cost of the pair (i, j) closing a multiloop, seen from inside the loop. */
  multiClosing(seq: NickedSequence, i: number, j: number): number {
    const type = REVERSE_TYPE[this.pair(seq.bases[i], seq.bases[j])];
    if (type === 0) return INF;
    const left = j - 1 > i && !seq.nickBefore[j] ? seq.bases[j - 1] : BASE_NONE;
    const right = i + 1 < j && !seq.nickBefore[i + 1] ? seq.bases[i + 1] : BASE_NONE;
    return this.stemTerm(type, left, right, true) + this.multiClosingTerm;
  }

  /**
   * Cost of the pair (i, j) when the loop it closes contains a nick, so that
   * the enclosed region is really part of the exterior loop.
   */
  nickedClosing(seq: NickedSequence, i: number, j: number): number {
    const type = REVERSE_TYPE[this.pair(seq.bases[i], seq.bases[j])];
    if (type === 0) return INF;
    const left = j - 1 > i && !seq.nickBefore[j] ? seq.bases[j - 1] : BASE_NONE;
    const right = i + 1 < j && !seq.nickBefore[i + 1] ? seq.bases[i + 1] : BASE_NONE;
    return this.stemTerm(type, left, right, false);
  }

  /** Boltzmann factor for an energy in kcal/mol. */
  boltzmann(energy: number): number {
    if (energy >= INF) return 0;
    return Math.exp(-energy / this.RT);
  }
}

export function describeModel(spec: ModelSpec): string {
  const material =
    spec.material === "dna" ? "DNA" : spec.material === "2ome-rna" ? "2'OMe-RNA" : "RNA";
  return `${material}, ${spec.celsius.toFixed(1)} °C, ${ENSEMBLE_LABELS[spec.ensemble]}`;
}
