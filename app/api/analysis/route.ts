import { NextResponse } from "next/server";
import { decodeSequence, encodeSequence } from "@/lib/nupack/alphabet";
import {
  analyzeJob,
  meltProfile,
  type JobSpec,
  type TubeSpec,
} from "@/lib/nupack/analysis";
import type { StrandSpecies } from "@/lib/nupack/complex";
import {
  toModelSpec,
  toSparse,
  type AnalysisRequest,
  type AnalysisResult,
  type AnalysisTemperatureResult,
} from "@/lib/nupack/job-types";
import { createJob, getJob } from "@/lib/server/jobs";

export const maxDuration = 300;

const MAX_STRANDS = 12;
const MAX_NUCLEOTIDES = 400;

export async function POST(request: Request) {
  let body: AnalysisRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request" }, { status: 400 });
  }

  try {
    const prepared = prepare(body);
    const id = createJob("analysis", body, () => compute(prepared, body));
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid job" },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  const job = getJob(id);
  if (!job) return NextResponse.json({ ok: false, error: "Unknown job" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    status: job.status,
    progress: job.progress ?? null,
    error: job.error ?? null,
    result: job.status === "done" ? job.result : null,
  });
}

interface Prepared {
  spec: JobSpec;
  names: string[];
}

function parseOrder(text: string, names: string[]): number[] {
  const tokens = text.split(/[\s,+]+/).filter(Boolean);
  return tokens.map((token) => {
    const index = names.findIndex((name) => name.toLowerCase() === token.toLowerCase());
    if (index < 0) throw new Error(`Unknown strand "${token}" in a complex list`);
    return index;
  });
}

function prepare(body: AnalysisRequest): Prepared {
  const strands = body.strands.filter((strand) => strand.sequence.replace(/\s+/g, "") !== "");
  if (strands.length === 0) throw new Error("Add at least one strand with a sequence");
  if (strands.length > MAX_STRANDS) {
    throw new Error(`This build supports up to ${MAX_STRANDS} strand species`);
  }

  const names = strands.map((strand, index) => strand.name || `Strand ${index + 1}`);
  const species: StrandSpecies[] = strands.map((strand, index) => {
    const clean = strand.sequence.replace(/\s+/g, "").toUpperCase();
    if (!/^[ACGTU]+$/.test(clean)) {
      throw new Error(`Strand ${names[index]} has characters outside A, C, G, T/U`);
    }
    if (clean.length > MAX_NUCLEOTIDES) {
      throw new Error(
        `Strand ${names[index]} is ${clean.length} nt; this build analyses strands up to ${MAX_NUCLEOTIDES} nt`,
      );
    }
    return { name: names[index], sequence: encodeSequence(clean) };
  });

  const tubes: TubeSpec[] = body.tubes.map((tube, index) => ({
    name: tube.name || `Tube ${index + 1}`,
    concentrations: strands.map((_, k) => tube.concentrations[k] ?? 0),
    maxComplexSize: Math.max(1, Math.min(6, Math.round(tube.maxComplexSize))),
    include: (tube.include ?? [])
      .filter((entry) => entry.trim() !== "")
      .map((entry) => parseOrder(entry, names)),
    exclude: (tube.exclude ?? [])
      .filter((entry) => entry.trim() !== "")
      .map((entry) => parseOrder(entry, names)),
  }));
  if (tubes.length === 0) throw new Error("Add at least one test tube");

  return {
    spec: { model: toModelSpec(body.model), species, tubes },
    names,
  };
}

function compute(prepared: Prepared, body: AnalysisRequest): AnalysisResult {
  const started = Date.now();
  const { spec, names } = prepared;
  const material = spec.model.material;

  const outcomes = body.melt
    ? meltProfile(spec, body.melt).outcomes
    : [analyzeJob(spec, spec.model.celsius)];

  const temperatures: AnalysisTemperatureResult[] = outcomes.map((outcome) => ({
    celsius: outcome.celsius,
    tubes: outcome.tubes.map((tube) => ({
      name: tube.name,
      fractionUnpaired: tube.fractionUnpaired,
      converged: tube.converged,
      complexes: tube.complexes.map((entry) => ({
        name: entry.id.name,
        size: entry.id.size,
        length: entry.id.length,
        freeEnergy: entry.freeEnergy,
        concentration: entry.concentration,
        mfeEnergy: entry.structureComputed ? entry.mfeEnergy : null,
        mfeStructure: entry.structureComputed ? entry.mfeStructure : null,
        order: entry.order.map((index) => names[index]),
        strandLengths: entry.order.map((index) => spec.species[index].sequence.length),
        sequence: entry.order
          .map((index) => decodeSequence(spec.species[index].sequence, material))
          .join("+"),
        pairProbabilities: entry.structureComputed
          ? toSparse(entry.n, entry.pairProbabilities)
          : null,
        unpaired: entry.structureComputed
          ? Array.from(entry.unpaired).map((value) => Number(value.toFixed(5)))
          : null,
      })),
    })),
  }));

  return {
    temperatures,
    melt: Boolean(body.melt),
    strandNames: names,
    elapsedMs: Date.now() - started,
  };
}
