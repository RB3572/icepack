import { NextResponse } from "next/server";
import { decodeSequence, encodeSequence, baseLetter } from "@/lib/nupack/alphabet";
import { Model, makeNickedSequence } from "@/lib/nupack/model";
import { structureEnergyDetailed } from "@/lib/nupack/energy";
import { mfe } from "@/lib/nupack/mfe";
import { partitionFunction } from "@/lib/nupack/pf";
import {
  StructureError,
  formatStructure,
  normalizeStructure,
  parseStructure,
} from "@/lib/nupack/structure";
import { ensembleDefect } from "@/lib/nupack/defect";
import { ensembleSize } from "@/lib/nupack/ensemble";
import { runDesign } from "@/lib/nupack/design";
import {
  toModelSpec,
  toSparse,
  type UtilitiesRequest,
  type UtilitiesResponse,
} from "@/lib/nupack/job-types";

export const maxDuration = 120;

const MAX_NUCLEOTIDES = 1200;

export async function POST(request: Request) {
  let body: UtilitiesRequest & { optimize?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request" }, { status: 400 });
  }

  try {
    return NextResponse.json(run(body));
  } catch (error) {
    const message =
      error instanceof StructureError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

function splitStrands(text: string): string[] {
  return text
    .replace(/\s+/g, "")
    .split("+")
    .filter((part, index, all) => part.length > 0 || all.length === 1);
}

function run(body: UtilitiesRequest & { optimize?: boolean }): UtilitiesResponse {
  const spec = toModelSpec(body.model);
  const model = new Model(spec);
  const warnings: string[] = [];

  const sequenceText = (body.sequence ?? "").replace(/\s+/g, "").toUpperCase();
  const structureText = (body.structure ?? "").replace(/\s+/g, "");

  let strandSequences = sequenceText ? splitStrands(sequenceText) : [];
  const hasSequence = strandSequences.some((part) => part.length > 0);

  // Structure first: it also fixes the strand split when no sequence is given.
  let pairs: number[] | null = null;
  let strandLengths: number[] | null = null;
  if (structureText) {
    const parsed = parseStructure(structureText);
    pairs = Array.from(parsed.pairs);
    strandLengths = parsed.strandLengths;
  }

  if (!hasSequence) {
    if (!pairs || !strandLengths) {
      return emptyResponse();
    }
    return {
      ok: true,
      sequence: "N".repeat(pairs.length),
      structure: formatStructure(pairs, strandLengths),
      strandLengths,
      pairs,
      strandCount: strandLengths.length,
      nucleotides: pairs.length,
      baseCounts: [],
      complexFreeEnergy: null,
      structureFreeEnergy: null,
      probability: null,
      ensembleDefect: null,
      normalizedEnsembleDefect: null,
      mfeStructure: null,
      mfeEnergy: null,
      ensembleSize: null,
      ensembleSizeLog10: null,
      stateProbabilities: null,
      pairProbabilities: null,
      unpaired: null,
      connected: true,
      warnings: ["Enter a sequence to evaluate equilibrium properties."],
    };
  }

  // Optionally design a sequence for the given structure first.
  if (body.optimize && pairs && strandLengths) {
    const designed = optimizeForStructure(body, strandLengths, structureText);
    strandSequences = designed;
  }

  for (const part of strandSequences) {
    if (!/^[ACGTUN]*$/.test(part)) {
      throw new Error(`Sequence contains characters outside A, C, G, T/U: "${part}"`);
    }
  }

  const encoded = strandSequences.map((part) => encodeSequence(part));
  const total = encoded.reduce((sum, part) => sum + part.length, 0);
  if (total === 0) return emptyResponse();
  if (total > MAX_NUCLEOTIDES) {
    throw new Error(
      `This build evaluates complexes up to ${MAX_NUCLEOTIDES} nt; the input has ${total} nt.`,
    );
  }
  const seq = makeNickedSequence(encoded);
  const sequenceLetters = encoded
    .map((part) => decodeSequence(part, spec.material))
    .join("");

  const minimum = mfe(seq, model);
  const mfeStructure = formatStructure(minimum.pairs, encoded.map((part) => part.length));

  if (!pairs || body.useMfe) {
    pairs = Array.from(minimum.pairs);
    strandLengths = encoded.map((part) => part.length);
  }

  if (pairs.length !== total) {
    throw new Error(
      `The structure has ${pairs.length} nucleotides but the sequence has ${total}.`,
    );
  }
  if (strandLengths && strandLengths.length !== encoded.length) {
    warnings.push(
      "The strand breaks in the structure and the sequence disagree; the sequence's breaks were used.",
    );
    strandLengths = encoded.map((part) => part.length);
  }

  const partition = partitionFunction(seq, model, { pairs: true });
  const counted = ensembleSize(seq, model);
  const evaluated = structureEnergyDetailed(seq, pairs, model);
  const defect = ensembleDefect(pairs, partition);

  const stateProbabilities = pairs.map((partner, i) =>
    partner < 0 ? partition.unpaired![i] : partition.pairProbabilities![i * total + partner],
  );

  const counts = new Map<string, number>();
  for (const base of encoded.flat()) {
    const letter = baseLetter(base, spec.material);
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  const order = spec.material === "dna" ? ["A", "C", "G", "T"] : ["A", "C", "G", "U"];
  const baseCounts = order.map((letter) => ({
    base: letter,
    count: counts.get(letter) ?? 0,
    percent: ((counts.get(letter) ?? 0) / total) * 100,
  }));
  const other = total - baseCounts.reduce((sum, entry) => sum + entry.count, 0);
  if (other > 0) {
    baseCounts.push({ base: "Other", count: other, percent: (other / total) * 100 });
  }

  if (!evaluated.connected) {
    warnings.push(
      "The specified structure does not connect every strand, so it is not a valid structure for this complex.",
    );
  }

  return {
    ok: true,
    sequence: sequenceLetters,
    structure: formatStructure(pairs, strandLengths ?? encoded.map((part) => part.length)),
    strandLengths: strandLengths ?? encoded.map((part) => part.length),
    pairs,
    strandCount: encoded.length,
    nucleotides: total,
    baseCounts,
    complexFreeEnergy: partition.freeEnergy,
    structureFreeEnergy: Number.isFinite(evaluated.energy) ? evaluated.energy : null,
    probability: Number.isFinite(evaluated.energy)
      ? Math.exp(-(evaluated.energy - partition.freeEnergy) / model.RT)
      : 0,
    ensembleDefect: defect,
    normalizedEnsembleDefect: total > 0 ? defect / total : 0,
    mfeStructure,
    mfeEnergy: Number.isFinite(minimum.energy) ? minimum.energy : null,
    ensembleSize: counted.count,
    ensembleSizeLog10: counted.log10,
    stateProbabilities,
    pairProbabilities: toSparse(total, partition.pairProbabilities!),
    unpaired: Array.from(partition.unpaired!).map((value) => Number(value.toFixed(6))),
    connected: evaluated.connected,
    warnings,
  };
}

function optimizeForStructure(
  body: UtilitiesRequest & { constraints?: string },
  strandLengths: number[],
  structureText: string,
): string[] {
  const constraint = (body.constraints ?? "").replace(/\s+/g, "").toUpperCase();
  const perStrand = constraint ? constraint.split("+") : [];
  const result = runDesign(
    {
      model: toModelSpec(body.model),
      domains: strandLengths.map((length, index) => ({
        name: `d${index + 1}`,
        constraint:
          perStrand[index] && perStrand[index].length === length
            ? perStrand[index]
            : "N".repeat(length),
      })),
      strands: strandLengths.map((_, index) => ({
        name: `s${index + 1}`,
        domains: [`d${index + 1}`],
      })),
      complexes: [
        {
          name: "target",
          strands: strandLengths.map((_, index) => `s${index + 1}`),
          structure: normalizeStructure(structureText),
        },
      ],
      tubes: [],
      stopCondition: 0.01,
      maxTime: 20,
      seed: 93,
      trials: 1,
    },
    "ensemble",
  );
  return result.strands.map((strand) => strand.sequence);
}

function emptyResponse(): UtilitiesResponse {
  return {
    ok: true,
    sequence: "",
    structure: "",
    strandLengths: [],
    pairs: [],
    strandCount: 0,
    nucleotides: 0,
    baseCounts: [],
    complexFreeEnergy: null,
    structureFreeEnergy: null,
    probability: null,
    ensembleDefect: null,
    normalizedEnsembleDefect: null,
    mfeStructure: null,
    mfeEnergy: null,
    ensembleSize: null,
    ensembleSizeLog10: null,
    stateProbabilities: null,
    pairProbabilities: null,
    unpaired: null,
    connected: true,
    warnings: [],
  };
}
