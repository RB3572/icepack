import type { ModelInput } from "@/lib/nupack/job-types";

export interface DesignDemo {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  question: string;
  model: Partial<ModelInput>;
  domains: Array<{ name: string; constraint: string }>;
  strands: Array<{ name: string; domains: string }>;
  complexes: Array<{ name: string; strands: string; structure: string }>;
  tubes: Array<{
    name: string;
    onTargets: Array<{ complex: string; amount: number; unit: string }>;
    maxComplexSize: number;
  }>;
  stopCondition: number;
  maxTime: number;
}

export const DESIGN_DEMOS: DesignDemo[] = [
  {
    id: "hairpin",
    title: "Demo 1",
    summary:
      "Design one RNA strand that adopts a hairpin with a 10-bp stem and a 6-nt loop, designing against dimer formation at the same time.",
    bullets: [
      "Material: RNA, 37 ºC",
      "One target complex of one strand",
      "Off-targets: every complex of up to 2 strands",
    ],
    question:
      "How far does the ensemble defect fall once the design also has to avoid homodimers?",
    model: { material: "rna", celsius: 37 },
    domains: [
      { name: "stem", constraint: "N10" },
      { name: "loop", constraint: "N6" },
    ],
    strands: [{ name: "h", domains: "stem loop stem*" }],
    complexes: [{ name: "hairpin", strands: "h", structure: "D10(U6)" }],
    tubes: [
      {
        name: "Tube",
        onTargets: [{ complex: "hairpin", amount: 1, unit: "uM" }],
        maxComplexSize: 2,
      },
    ],
    stopCondition: 0.02,
    maxTime: 60,
  },
  {
    id: "toehold",
    title: "Demo 2",
    summary:
      "Design a toehold-mediated strand displacement substrate: an incumbent strand bound to a longer template that leaves a single-stranded toehold exposed.",
    bullets: [
      "Material: DNA, 25 ºC",
      "Domains: toehold t (6 nt) and branch migration domain b (18 nt)",
      "Target complex: the template bound to the incumbent, toehold free",
    ],
    question:
      "Does the designed toehold stay single stranded, and do the free strands avoid structure of their own?",
    model: { material: "dna", celsius: 25 },
    domains: [
      { name: "t", constraint: "N6" },
      { name: "b", constraint: "N18" },
    ],
    strands: [
      { name: "template", domains: "b* t*" },
      { name: "incumbent", domains: "b" },
    ],
    complexes: [
      {
        name: "substrate",
        strands: "template incumbent",
        structure: "D18(U6+)",
      },
      { name: "incumbentAlone", strands: "incumbent", structure: "U18" },
    ],
    tubes: [
      {
        name: "Substrate",
        onTargets: [
          { complex: "substrate", amount: 1, unit: "uM" },
          { complex: "incumbentAlone", amount: 0.1, unit: "uM" },
        ],
        maxComplexSize: 2,
      },
    ],
    stopCondition: 0.03,
    maxTime: 90,
  },
  {
    id: "junction",
    title: "Demo 3",
    summary:
      "Design three strands that assemble into a three-arm junction, each arm an 8-bp duplex.",
    bullets: [
      "Material: DNA, 37 ºC",
      "Three strands, three target complexes (the junction plus the free monomers)",
      "Off-targets: every complex of up to 2 strands",
    ],
    question:
      "Can the three arms be made orthogonal enough that no two strands pair without the third?",
    model: { material: "dna", celsius: 37 },
    domains: [
      { name: "a", constraint: "N8" },
      { name: "b", constraint: "N8" },
      { name: "c", constraint: "N8" },
    ],
    strands: [
      { name: "s1", domains: "a b*" },
      { name: "s2", domains: "b c*" },
      { name: "s3", domains: "c a*" },
    ],
    complexes: [
      {
        name: "junction",
        strands: "s1 s2 s3",
        structure: "((((((((((((((((+))))))))((((((((+))))))))))))))))",
      },
    ],
    tubes: [
      {
        name: "Junction",
        onTargets: [{ complex: "junction", amount: 1, unit: "uM" }],
        maxComplexSize: 2,
      },
    ],
    stopCondition: 0.05,
    maxTime: 120,
  },
];
