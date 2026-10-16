"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StructureDiagram } from "@/components/viz/StructureDiagram";
import { downloadJson, downloadText } from "@/lib/client/download";
import type { DesignResultPayload } from "@/lib/nupack/job-types";
import { parseStructure } from "@/lib/nupack/structure";

export function DesignResults({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<"running" | "done" | "error">("running");
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<DesignResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/design?id=${jobId}`);
        const payload = await response.json();
        if (cancelled) return;
        if (!payload.ok) {
          setStatus("error");
          setError(payload.error);
          return;
        }
        setProgress(payload.progress);
        if (payload.status === "done") {
          setResult(payload.result as DesignResultPayload);
          setStatus("done");
          return;
        }
        if (payload.status === "error") {
          setStatus("error");
          setError(payload.error);
          return;
        }
        timer = setTimeout(poll, 1000);
      } catch (caught) {
        if (cancelled) return;
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "Polling failed");
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  const complex = result?.complexes[selected] ?? null;
  const parsed = useMemo(
    () => (complex ? parseStructure(complex.structure) : null),
    [complex],
  );

  if (status === "running") {
    return (
      <p className="note">
        <span className="spin" /> Designing. {progress ?? "Evaluating the first sequence…"}
      </p>
    );
  }
  if (status === "error" || !result) {
    return (
      <div>
        <p className="error">{error ?? "The job could not be found."}</p>
        <p>
          <Link href="/design/input">Back to input</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <span className="section-title" style={{ margin: 0 }}>
            {result.stopConditionMet ? "Stop condition met" : "Design finished"}
          </span>
          <div className="note">
            normalized defect {result.defect.toFixed(4)} · {result.mutations} mutations ·{" "}
            {result.seconds.toFixed(1)} s
          </div>
        </div>
        <button
          className="btn-quiet"
          type="button"
          onClick={() =>
            downloadText(
              "designed-sequences.txt",
              result.strands.map((strand) => `>${strand.name}\n${strand.sequence}`).join("\n"),
            )
          }
        >
          ⬇ Download sequences
        </button>
      </div>

      <div className="section-title">Designed strands</div>
      <table className="grid" style={{ maxWidth: 760 }}>
        <thead>
          <tr>
            <th style={{ width: 120 }}>Strand</th>
            <th>Sequence</th>
            <th style={{ width: 60 }}>nt</th>
          </tr>
        </thead>
        <tbody>
          {result.strands.map((strand) => (
            <tr key={strand.name}>
              <td>{strand.name}</td>
              <td className="seq-input" style={{ wordBreak: "break-all" }}>
                {strand.sequence}
              </td>
              <td>{strand.sequence.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">Designed domains</div>
      <table className="grid" style={{ maxWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ width: 120 }}>Domain</th>
            <th>Sequence</th>
          </tr>
        </thead>
        <tbody>
          {result.domains.map((domain) => (
            <tr key={domain.name}>
              <td>{domain.name}</td>
              <td className="seq-input" style={{ wordBreak: "break-all" }}>
                {domain.sequence}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">Target complexes</div>
      <table className="grid">
        <thead>
          <tr>
            <th>Complex</th>
            <th>ΔG(φ,s)</th>
            <th>ΔG(φ)</th>
            <th>p(φ,s)</th>
            <th>n(φ,s)</th>
            <th>normalized</th>
            <th>μ(φ,s)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {result.complexes.map((entry, index) => (
            <tr key={entry.name}>
              <td>{entry.name}</td>
              <td>{entry.structureFreeEnergy.toFixed(2)}</td>
              <td>{entry.complexFreeEnergy.toFixed(2)}</td>
              <td>{entry.probability.toPrecision(3)}</td>
              <td>{entry.ensembleDefect.toFixed(2)}</td>
              <td>{(entry.normalizedDefect * 100).toFixed(2)} %</td>
              <td>{entry.mfeDefect.toFixed(0)}</td>
              <td>
                <button className="btn-quiet" type="button" onClick={() => setSelected(index)}>
                  view
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.tubes.length > 0 && (
        <>
          <div className="section-title">Target tubes</div>
          <table className="grid" style={{ maxWidth: 640 }}>
            <thead>
              <tr>
                <th>Tube</th>
                <th>Complex</th>
                <th>Target concentration</th>
                <th>Equilibrium concentration</th>
              </tr>
            </thead>
            <tbody>
              {result.tubes.flatMap((tube) =>
                tube.complexes.map((entry, index) => (
                  <tr key={`${tube.name}-${entry.name}`}>
                    <td>
                      {index === 0 ? `${tube.name} (defect ${tube.defect.toFixed(4)})` : ""}
                    </td>
                    <td>{entry.name}</td>
                    <td>{entry.target.toExponential(2)} M</td>
                    <td>{entry.concentration.toExponential(2)} M</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </>
      )}

      {complex && parsed && (
        <section className="card">
          <header>
            <strong style={{ fontSize: 13 }}>{complex.name}</strong>
          </header>
          <StructureDiagram
            sequence={complex.sequence.replace(/\+/g, "")}
            pairs={Array.from(parsed.pairs)}
            strandLengths={parsed.strandLengths}
            shading="identity"
            showBaseLetters
            topText={`${complex.name} target structure`}
            bottomText={`ΔG = ${complex.structureFreeEnergy.toFixed(2)} kcal/mol, p = ${complex.probability.toPrecision(3)}`}
            width={520}
            height={420}
          />
          <div>
            <div className="field-label">Sequence</div>
            <code style={{ fontSize: 11, wordBreak: "break-all" }}>{complex.sequence}</code>
            <div className="field-label" style={{ marginTop: 6 }}>
              Target structure
            </div>
            <code style={{ fontSize: 11, wordBreak: "break-all" }}>{complex.structure}</code>
          </div>
        </section>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <Link href="/design/input">← Back to input</Link>
        <button
          className="btn-quiet"
          type="button"
          onClick={() => downloadJson("design-results.json", result)}
        >
          ⬇ Download job
        </button>
      </div>
    </div>
  );
}
