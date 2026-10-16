import type { ModelInput } from "@/lib/nupack/job-types";

export interface AnalysisDemo {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  question: string;
  model: Partial<ModelInput>;
  strands: Array<{ name: string; sequence: string }>;
  tubes: Array<{
    name: string;
    rows: Array<{ strand: number; amount: number; unit: string }>;
    maxComplexSize: number;
    include?: string[];
    exclude?: string[];
  }>;
  melt?: { min: number; max: number; step: number };
}

/** Three strands that assemble into a three-way junction. */
const JUNCTION = {
  A: "GCTTGAGATGTTAGGGAGTAGTGCTCCAATCACAACGCACTACTCCCTAACATC",
  B: "AGGGAGTAGTGCGTTGTGATTGGAAACATCTCAAGCTCCAATCACAACGCACTA",
  C: "GTTGTGATTGGAGCTTGAGATGTTGCACTACTCCCTAACATCTCAAGCTCCAAT",
};

/** Hybridization chain reaction hairpins and initiator (Dirks & Pierce, 2004). */
const HCR = {
  i1: "CCACACCACAACAACCACATCTCG",
  h1: "CGAGATGTGGTTGTTGTGGTGTGGATACAACCACACCACAACAACCAC",
  h2: "CCACACCACAACAACCACATCTCGGTGGTTGTTGTGGTGTGGTTGTAT",
};

export const DEMOS: AnalysisDemo[] = [
  {
    id: "junction",
    title: "Demo 1",
    summary:
      "Over a range of temperatures, analyze a test tube ensemble containing 3 strand species that interact to form all complex species of up to 3 strands.",
    bullets: ["Material: DNA", "Temperature range: 35 ºC to 95 ºC", "Three strands at 750 nM each"],
    question: "Why are there two transitions in the melt curve?",
    model: { material: "dna", celsius: 37, ensemble: "stacking" },
    strands: [
      { name: "A", sequence: JUNCTION.A },
      { name: "B", sequence: JUNCTION.B },
      { name: "C", sequence: JUNCTION.C },
    ],
    tubes: [
      {
        name: "Demo",
        rows: [
          { strand: 0, amount: 750, unit: "nM" },
          { strand: 1, amount: 750, unit: "nM" },
          { strand: 2, amount: 750, unit: "nM" },
        ],
        maxComplexSize: 3,
      },
    ],
    melt: { min: 35, max: 95, step: 5 },
  },
  {
    id: "hcr",
    title: "Demo 2",
    summary:
      "Analyze two test tube ensembles that model different stages of hybridization chain reaction polymerization.",
    bullets: [
      "Strand species: initiator i1, hairpins h1 and h2",
      "Tube t1: all complexes of up to 3 strands plus the cognate 4-mer",
      "Tube t2: the same plus the cognate 4-mer and 5-mer",
      "Material: DNA, 23 ºC",
    ],
    question:
      "Is the substoichiometric initiator predominantly consumed by polymers of the maximum permitted length, and are the excess hairpins predominantly non-interacting?",
    model: { material: "dna", celsius: 23, ensemble: "stacking" },
    strands: [
      { name: "i1", sequence: HCR.i1 },
      { name: "h1", sequence: HCR.h1 },
      { name: "h2", sequence: HCR.h2 },
    ],
    tubes: [
      {
        name: "t1",
        rows: [
          { strand: 0, amount: 0.1, unit: "uM" },
          { strand: 1, amount: 1, unit: "uM" },
          { strand: 2, amount: 1, unit: "uM" },
        ],
        maxComplexSize: 3,
        include: ["i1 h1 h2 h1"],
      },
      {
        name: "t2",
        rows: [
          { strand: 0, amount: 0.1, unit: "uM" },
          { strand: 1, amount: 1, unit: "uM" },
          { strand: 2, amount: 1, unit: "uM" },
        ],
        maxComplexSize: 3,
        include: ["i1 h1 h2 h1", "i1 h1 h2 h1 h2"],
      },
    ],
  },
  {
    id: "gc",
    title: "Demo 3",
    summary:
      "Simulate melt curves for three DNA duplexes of equal length and increasing GC content, each in its own test tube.",
    bullets: [
      "Material: DNA",
      "Temperature range: 20 ºC to 90 ºC",
      "Each duplex at 1 µM per strand",
    ],
    question: "How does GC content shift the melting temperature of a duplex of fixed length?",
    model: { material: "dna", celsius: 37, ensemble: "stacking" },
    strands: [
      { name: "lowGC", sequence: "ATATTAACATTAATATTAAC" },
      { name: "lowGCc", sequence: "GTTAATATTAATGTTAATAT" },
      { name: "midGC", sequence: "ATCGTAACGTTAACGATTAC" },
      { name: "midGCc", sequence: "GTAATCGTTAACGTTACGAT" },
      { name: "highGC", sequence: "GCCGTAGCGTCGACGCTTAC" },
      { name: "highGCc", sequence: "GTAAGCGTCGACGCTACGGC" },
    ],
    tubes: [
      {
        name: "40% GC",
        rows: [
          { strand: 0, amount: 1, unit: "uM" },
          { strand: 1, amount: 1, unit: "uM" },
        ],
        maxComplexSize: 2,
      },
      {
        name: "45% GC",
        rows: [
          { strand: 2, amount: 1, unit: "uM" },
          { strand: 3, amount: 1, unit: "uM" },
        ],
        maxComplexSize: 2,
      },
      {
        name: "65% GC",
        rows: [
          { strand: 4, amount: 1, unit: "uM" },
          { strand: 5, amount: 1, unit: "uM" },
        ],
        maxComplexSize: 2,
      },
    ],
    melt: { min: 20, max: 90, step: 5 },
  },
];
