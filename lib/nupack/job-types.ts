/** Shapes exchanged between the pages and the API routes. */
import type { EnsembleName, ModelSpec } from "./model";
import type { Material } from "./alphabet";

export interface ModelInput {
  material: Material;
  celsius: number;
  ensemble: EnsembleName;
  sodium: number;
  magnesium: number;
  wobble?: boolean;
  parameterSet?: string;
}

export function toModelSpec(input: ModelInput): ModelSpec {
  return {
    material: input.material,
    celsius: input.celsius,
    ensemble: input.ensemble,
    sodium: input.sodium,
    magnesium: input.magnesium,
    wobble: input.wobble,
    parameterSet: input.parameterSet,
  };
}

/** Sparse upper-triangle representation of a pair probability matrix. */
export interface SparseMatrix {
  n: number;
  i: number[];
  j: number[];
  p: number[];
}

export function toSparse(
  n: number,
  matrix: Float64Array,
  threshold = 1e-5,
): SparseMatrix {
  const i: number[] = [];
  const j: number[] = [];
  const p: number[] = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const value = matrix[a * n + b];
      if (value > threshold) {
        i.push(a);
        j.push(b);
        p.push(Number(value.toFixed(6)));
      }
    }
  }
  return { n, i, j, p };
}

export function fromSparse(sparse: SparseMatrix): Float64Array {
  const out = new Float64Array(sparse.n * sparse.n);
  for (let k = 0; k < sparse.i.length; k++) {
    out[sparse.i[k] * sparse.n + sparse.j[k]] = sparse.p[k];
    out[sparse.j[k] * sparse.n + sparse.i[k]] = sparse.p[k];
  }
  return out;
}

// ---------------- Utilities ----------------

export interface UtilitiesRequest {
  model: ModelInput;
  sequence: string;
  structure: string;
  /** Replace the structure with the MFE structure of the sequence. */
  useMfe?: boolean;
}

export interface UtilitiesResponse {
  ok: true;
  sequence: string;
  structure: string;
  strandLengths: number[];
  pairs: number[];
  strandCount: number;
  nucleotides: number;
  baseCounts: Array<{ base: string; count: number; percent: number }>;
  complexFreeEnergy: number | null;
  structureFreeEnergy: number | null;
  probability: number | null;
  ensembleDefect: number | null;
  normalizedEnsembleDefect: number | null;
  mfeStructure: string | null;
  mfeEnergy: number | null;
  /** Number of unpseudoknotted secondary structures in the ensemble. */
  ensembleSize: number | null;
  ensembleSizeLog10: number | null;
  /** Probability of each base being in the state the given structure assigns. */
  stateProbabilities: number[] | null;
  pairProbabilities: SparseMatrix | null;
  unpaired: number[] | null;
  connected: boolean;
  warnings: string[];
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

// ---------------- Analysis ----------------

export interface AnalysisStrandInput {
  name: string;
  sequence: string;
}

export interface AnalysisTubeInput {
  name: string;
  /** Concentration per strand, aligned with the strand list, in molar. */
  concentrations: number[];
  maxComplexSize: number;
  include: string[];
  exclude: string[];
}

export interface AnalysisRequest {
  model: ModelInput;
  strands: AnalysisStrandInput[];
  tubes: AnalysisTubeInput[];
  melt?: { min: number; max: number; step: number } | null;
}

export interface AnalysisComplexResult {
  name: string;
  size: number;
  length: number;
  freeEnergy: number;
  concentration: number;
  mfeEnergy: number | null;
  mfeStructure: string | null;
  order: string[];
  strandLengths: number[];
  sequence: string;
  pairProbabilities: SparseMatrix | null;
  unpaired: number[] | null;
}

export interface AnalysisTubeResult {
  name: string;
  complexes: AnalysisComplexResult[];
  fractionUnpaired: number;
  converged: boolean;
}

export interface AnalysisTemperatureResult {
  celsius: number;
  tubes: AnalysisTubeResult[];
}

export interface AnalysisResult {
  temperatures: AnalysisTemperatureResult[];
  melt: boolean;
  strandNames: string[];
  elapsedMs: number;
}

// ---------------- Design ----------------

export interface DesignRequest {
  model: ModelInput;
  domains: Array<{ name: string; constraint: string }>;
  strands: Array<{ name: string; domains: string }>;
  complexes: Array<{ name: string; strands: string; structure: string }>;
  tubes: Array<{
    name: string;
    onTargets: Array<{ complex: string; concentration: number }>;
    maxComplexSize: number;
  }>;
  stopCondition: number;
  maxTime: number;
  seed: number;
  trials: number;
}

export interface DesignResultPayload {
  defect: number;
  stopConditionMet: boolean;
  mutations: number;
  seconds: number;
  domains: Array<{ name: string; sequence: string }>;
  strands: Array<{ name: string; sequence: string }>;
  complexes: Array<{
    name: string;
    sequence: string;
    structure: string;
    ensembleDefect: number;
    normalizedDefect: number;
    structureFreeEnergy: number;
    complexFreeEnergy: number;
    probability: number;
    mfeDefect: number;
  }>;
  tubes: Array<{
    name: string;
    defect: number;
    complexes: Array<{ name: string; concentration: number; target: number }>;
  }>;
}
