"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ConcentrationInput,
  Disclosure,
  Help,
  unitFactor,
} from "@/components/Controls";
import {
  DEFAULT_MODEL_INPUT,
  MaterialAndTemperature,
  ModelOptions,
} from "@/components/ModelOptions";
import type { AnalysisRequest, ModelInput } from "@/lib/nupack/job-types";
import { downloadJson } from "@/lib/client/download";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { DEMOS } from "../demos/demos";

export interface StrandDraft {
  name: string;
  sequence: string;
}

export interface TubeDraft {
  name: string;
  rows: Array<{ strand: number; amount: number; unit: string }>;
  maxComplexSize: number;
  include: string[];
  exclude: string[];
  showComplexOptions: boolean;
}

export function AnalysisInput() {
  return (
    <Suspense fallback={<p className="note">Loading…</p>}>
      <AnalysisInputInner />
    </Suspense>
  );
}

function newTube(name: string, strandCount: number): TubeDraft {
  return {
    name,
    rows: Array.from({ length: strandCount }, (_, index) => ({
      strand: index,
      amount: 1,
      unit: "uM",
    })),
    maxComplexSize: 1,
    include: [],
    exclude: [],
    showComplexOptions: false,
  };
}

function AnalysisInputInner() {
  const router = useRouter();
  const params = useSearchParams();

  const initial = useMemo(() => initialState(params), [params]);
  const [model, setModel] = useState<ModelInput>(initial.model);
  const [strands, setStrands] = useState<StrandDraft[]>(initial.strands);
  const [tubes, setTubes] = useState<TubeDraft[]>(initial.tubes);
  const [melt, setMelt] = useState(initial.melt);
  const [range, setRange] = useState(initial.range);
  const [openModel, setOpenModel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request: AnalysisRequest = useMemo(
    () => ({
      model,
      strands,
      tubes: tubes.map((tube) => ({
        name: tube.name,
        concentrations: strands.map((_, index) => {
          const row = tube.rows.find((entry) => entry.strand === index);
          return row ? row.amount * unitFactor(row.unit) : 0;
        }),
        maxComplexSize: tube.maxComplexSize,
        include: tube.include,
        exclude: tube.exclude,
      })),
      melt: melt ? range : null,
    }),
    [model, strands, tubes, melt, range],
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error);
        setBusy(false);
        return;
      }
      router.push(`/analysis/results/${payload.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
      setBusy(false);
    }
  }

  const updateStrand = (index: number, patch: Partial<StrandDraft>) =>
    setStrands((current) =>
      current.map((strand, i) => (i === index ? { ...strand, ...patch } : strand)),
    );

  const updateTube = (index: number, patch: Partial<TubeDraft>) =>
    setTubes((current) => current.map((tube, i) => (i === index ? { ...tube, ...patch } : tube)));

  return (
    <div>
      <MaterialAndTemperature
        value={model}
        onChange={setModel}
        extra={
          <>
            <label style={{ fontSize: 12, paddingBottom: 4 }}>
              <input type="checkbox" checked={melt} onChange={(e) => setMelt(e.target.checked)} />{" "}
              Melt <Help text="Run the analysis across a temperature range." />
            </label>
            {melt && (
              <div className="row" style={{ gap: 10 }}>
                {(["min", "step", "max"] as const).map((key) => (
                  <span key={key}>
                    <span className="note" style={{ textTransform: "capitalize" }}>
                      {key}
                    </span>{" "}
                    <input
                      type="text"
                      value={range[key]}
                      onChange={(event) =>
                        setRange({ ...range, [key]: Number(event.target.value) || 0 })
                      }
                      style={{ width: 52 }}
                    />
                  </span>
                ))}
                <span className="note">°C</span>
              </div>
            )}
          </>
        }
      />

      <ModelOptions
        value={model}
        onChange={setModel}
        open={openModel}
        onToggle={() => setOpenModel((value) => !value)}
      />

      {tubes.map((tube, tubeIndex) => (
        <section key={tubeIndex} className="card">
          <header>
            <strong style={{ fontSize: 13 }}>Tube: {tube.name}</strong>
            {tubes.length > 1 && (
              <button
                className="btn-icon"
                type="button"
                title="Remove tube"
                onClick={() => setTubes((current) => current.filter((_, i) => i !== tubeIndex))}
              >
                🗑
              </button>
            )}
          </header>

          <div className="field-label">
            Tube <Help text="Name used to label this test tube in the results." />
          </div>
          <input
            type="text"
            value={tube.name}
            onChange={(event) => updateTube(tubeIndex, { name: event.target.value })}
            style={{ width: 220 }}
          />

          <div className="section-title">
            Species <Help text="Strand species in this tube and their total concentrations." />
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 130 }}>Strand</th>
                <th>Sequence</th>
                <th style={{ width: 150 }}>Concentration</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {tube.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td>
                    <input
                      type="text"
                      value={strands[row.strand]?.name ?? ""}
                      onChange={(event) => updateStrand(row.strand, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="seq-input"
                      spellCheck={false}
                      value={strands[row.strand]?.sequence ?? ""}
                      onChange={(event) =>
                        updateStrand(row.strand, {
                          sequence: event.target.value.toUpperCase(),
                        })
                      }
                    />
                  </td>
                  <td>
                    <ConcentrationInput
                      amount={row.amount}
                      unit={row.unit}
                      onChange={(amount, unit) =>
                        updateTube(tubeIndex, {
                          rows: tube.rows.map((entry, i) =>
                            i === rowIndex ? { ...entry, amount, unit } : entry,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="btn-icon"
                      type="button"
                      title="Remove strand"
                      onClick={() =>
                        updateTube(tubeIndex, {
                          rows: tube.rows.filter((_, i) => i !== rowIndex),
                        })
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="btn-quiet"
            type="button"
            onClick={() => {
              const next = strands.length;
              setStrands([...strands, { name: `Strand ${next + 1}`, sequence: "" }]);
              updateTube(tubeIndex, {
                rows: [...tube.rows, { strand: next, amount: 1, unit: "uM" }],
              });
            }}
          >
            ⊕ Add Strand
          </button>

          <div className="section-title">
            Complexes{" "}
            <Help text="Which complexes this tube's ensemble contains." />
          </div>
          <div className="row">
            <div>
              <div className="field-label">Max complex size</div>
              <span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={tube.maxComplexSize}
                  onChange={(event) =>
                    updateTube(tubeIndex, { maxComplexSize: Number(event.target.value) || 1 })
                  }
                  style={{ width: 56 }}
                />{" "}
                <span className="note">strands</span>
              </span>
            </div>
          </div>

          <Disclosure
            label="Include or exclude specific complexes"
            open={tube.showComplexOptions}
            onToggle={() =>
              updateTube(tubeIndex, { showComplexOptions: !tube.showComplexOptions })
            }
          >
            <ComplexList
              title="Include complex"
              entries={tube.include}
              onChange={(include) => updateTube(tubeIndex, { include })}
            />
            <ComplexList
              title="Exclude complex"
              entries={tube.exclude}
              onChange={(exclude) => updateTube(tubeIndex, { exclude })}
            />
          </Disclosure>
        </section>
      ))}

      <button
        className="btn-quiet"
        type="button"
        onClick={() => setTubes([...tubes, newTube(`Tube ${tubes.length + 1}`, strands.length)])}
      >
        ⊕ Add Tube
      </button>

      {error && <p className="error">{error}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
        <button
          className="btn-quiet"
          type="button"
          onClick={() => downloadJson("analysis-job.json", request)}
        >
          ⬇ Download job
        </button>
        <button className="btn" type="button" onClick={submit} disabled={busy}>
          {busy ? <span className="spin" /> : "Analyze"}
        </button>
      </div>
    </div>
  );
}

function ComplexList({
  title,
  entries,
  onChange,
}: {
  title: string;
  entries: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <table className="grid" style={{ maxWidth: 460 }}>
        <thead>
          <tr>
            <th>{title}</th>
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  placeholder="Strand order, e.g. A B A"
                  value={entry}
                  onChange={(event) =>
                    onChange(entries.map((value, i) => (i === index ? event.target.value : value)))
                  }
                />
              </td>
              <td>
                <button
                  className="btn-icon"
                  type="button"
                  onClick={() => onChange(entries.filter((_, i) => i !== index))}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-quiet" type="button" onClick={() => onChange([...entries, ""])}>
        ⊕ Add {title.split(" ")[0]}
      </button>
    </div>
  );
}

/** Demo links and the Utilities hand-off arrive as query parameters. */
function initialState(params: URLSearchParams | ReadonlyURLSearchParams) {
  const fallback = {
    model: DEFAULT_MODEL_INPUT,
    strands: [{ name: "Strand 1", sequence: "" }] as StrandDraft[],
    tubes: [newTube("Tube 1", 1)],
    melt: false,
    range: { min: 20, max: 95, step: 2.5 },
  };

  const demoId = params.get("demo");
  if (demoId) {
    const demo = DEMOS.find((entry) => entry.id === demoId);
    if (demo) {
      return {
        model: { ...DEFAULT_MODEL_INPUT, ...demo.model },
        strands: demo.strands,
        tubes: demo.tubes.map((tube) => ({
          name: tube.name,
          rows: tube.rows,
          maxComplexSize: tube.maxComplexSize,
          include: tube.include ?? [],
          exclude: tube.exclude ?? [],
          showComplexOptions: (tube.include ?? []).length > 0,
        })),
        melt: Boolean(demo.melt),
        range: demo.melt ?? fallback.range,
      };
    }
  }

  const sequence = params.get("sequence");
  const material = params.get("material");
  const celsius = params.get("celsius");
  const parts = sequence ? sequence.split("+").filter(Boolean) : [];

  return {
    ...fallback,
    model: {
      ...DEFAULT_MODEL_INPUT,
      material: (material as ModelInput["material"]) ?? DEFAULT_MODEL_INPUT.material,
      celsius: celsius ? Number(celsius) : DEFAULT_MODEL_INPUT.celsius,
    },
    strands:
      parts.length > 0
        ? parts.map((part, index) => ({ name: `Strand ${index + 1}`, sequence: part }))
        : fallback.strands,
    tubes: parts.length > 0 ? [newTube("Tube 1", parts.length)] : fallback.tubes,
  };
}
