import { NextResponse } from "next/server";
import { runDesign, type DesignJob } from "@/lib/nupack/design";
import { toModelSpec, type DesignRequest } from "@/lib/nupack/job-types";
import { createJob, getJob } from "@/lib/server/jobs";


export async function POST(request: Request) {
  let body: DesignRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request" }, { status: 400 });
  }

  try {
    const job = prepare(body);
    const objective = body.tubes.length > 0 ? "multitube" : "ensemble";
    const id = createJob("design", body, (update) =>
      runDesign(job, objective, (defect, mutations) => {
        update(`defect ${defect.toFixed(4)} after ${mutations} mutations`);
      }),
    );
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

function prepare(body: DesignRequest): DesignJob {
  const domains = body.domains
    .filter((domain) => domain.name.trim() !== "")
    .map((domain) => {
      const constraint = domain.constraint.replace(/\s+/g, "").toUpperCase();
      if (constraint === "") {
        throw new Error(`Domain "${domain.name}" needs a length or a sequence constraint`);
      }
      const expanded = expandConstraint(constraint);
      if (!/^[ACGTUNRYSWKMBDHV]+$/.test(expanded)) {
        throw new Error(`Domain "${domain.name}" has characters outside the IUPAC codes`);
      }
      return { name: domain.name.trim(), constraint: expanded };
    });
  if (domains.length === 0) throw new Error("Add at least one domain");

  const strands = body.strands
    .filter((strand) => strand.name.trim() !== "")
    .map((strand) => ({
      name: strand.name.trim(),
      domains: strand.domains.split(/[\s,]+/).filter(Boolean),
    }));
  if (strands.length === 0) throw new Error("Add at least one strand");

  const complexes = body.complexes
    .filter((complex) => complex.name.trim() !== "")
    .map((complex) => ({
      name: complex.name.trim(),
      strands: complex.strands.split(/[\s,+]+/).filter(Boolean),
      structure: complex.structure.replace(/\s+/g, ""),
    }));
  if (complexes.length === 0) throw new Error("Add at least one target complex");

  const total = complexes.reduce((sum, complex) => sum + complex.structure.length, 0);
  if (total > 600) {
    throw new Error(
      "The target complexes total more than 600 nucleotides; this build keeps design jobs below that.",
    );
  }

  return {
    model: toModelSpec(body.model),
    domains,
    strands,
    complexes,
    tubes: body.tubes
      .filter((tube) => tube.onTargets.length > 0)
      .map((tube) => ({
        name: tube.name,
        onTargets: tube.onTargets.filter((entry) => entry.complex.trim() !== ""),
        maxComplexSize: Math.max(1, Math.min(4, Math.round(tube.maxComplexSize))),
      })),
    stopCondition: body.stopCondition > 0 ? body.stopCondition : 0.05,
    maxTime: Math.max(1, Math.min(300, body.maxTime)),
    seed: body.seed || 0,
    trials: Math.max(1, Math.min(10, body.trials)),
  };
}

/**
 * Accepts the same shorthand the Design page offers: a bare length ("12"), or
 * run-length codes such as "N10" or "N6S2", as well as a plain IUPAC string.
 */
function expandConstraint(text: string): string {
  if (/^\d+$/.test(text)) return "N".repeat(Number(text));
  return text.replace(/([ACGTUNRYSWKMBDHV])(\d+)/g, (_, letter: string, count: string) =>
    letter.repeat(Number(count)),
  );
}
