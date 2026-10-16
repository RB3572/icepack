"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";
import {
  ConcentrationInput,
  Disclosure,
  Help,
  RadioGroup,
  unitFactor,
} from "@/components/Controls";
import {
  DEFAULT_MODEL_INPUT,
  MaterialAndTemperature,
  ModelOptions,
} from "@/components/ModelOptions";
import { downloadJson } from "@/lib/client/download";
import type { DesignRequest, ModelInput } from "@/lib/nupack/job-types";
import { DESIGN_DEMOS } from "../demos/demos";

interface DomainDraft {
  name: string;
  constraint: string;
}
interface StrandDraft {
  name: string;
  domains: string;
}
interface ComplexDraft {
  name: string;
  strands: string;
  structure: string;
}
interface TubeDraft {
  name: string;
  onTargets: Array<{ complex: string; amount: number; unit: string }>;
  maxComplexSize: number;
}

export function DesignInput() {
  return (
    <Suspense fallback={<p className="note">Loading…</p>}>
      <DesignInputInner />
    </Suspense>
  );
}

function DesignInputInner() {
  const router = useRouter();
  const params = useSearchParams();

  const initial = useMemo(() => initialState(params), [params]);
  const [model, setModel] = useState<ModelInput>(initial.model);
  const [trials, setTrials] = useState(1);
  const [stopCondition, setStopCondition] = useState(initial.stopCondition);
  const [maxTime, setMaxTime] = useState(initial.maxTime);
  const [seed, setSeed] = useState(0);
  const [wobble, setWobble] = useState<"allow" | "prohibit">("allow");

  const [domains, setDomains] = useState<DomainDraft[]>(initial.domains);
  const [strands, setStrands] = useState<StrandDraft[]>(initial.strands);
  const [complexes, setComplexes] = useState<ComplexDraft[]>(initial.complexes);
  const [tubes, setTubes] = useState<TubeDraft[]>(initial.tubes);

  const [openModel, setOpenModel] = useState(false);
  const [openAlgorithm, setOpenAlgorithm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request: DesignRequest = useMemo(
    () => ({
      model: { ...model, wobble: wobble === "allow" ? model.wobble : false },
      domains: domains.map((domain) => ({
        name: domain.name,
        constraint: expandConstraint(domain.constraint),
      })),
      strands,
      complexes,
      tubes: tubes.map((tube) => ({
        name: tube.name,
        onTargets: tube.onTargets.map((entry) => ({
          complex: entry.complex,
          concentration: entry.amount * unitFactor(entry.unit),
        })),
        maxComplexSize: tube.maxComplexSize,
      })),
      stopCondition,
      maxTime,
      seed,
      trials,
    }),
    [model, wobble, domains, strands, complexes, tubes, stopCondition, maxTime, seed, trials],
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/design", {
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
      router.push(`/design/results/${payload.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <MaterialAndTemperature
        value={model}
        onChange={setModel}
        extra={
          <div>
            <div className="field-label">
              Trials <Help text="Independent design attempts; the best result is kept." />
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={trials}
              onChange={(event) => setTrials(Number(event.target.value) || 1)}
              style={{ width: 56 }}
            />
          </div>
        }
      />

      <ModelOptions
        value={model}
        onChange={setModel}
        open={openModel}
        onToggle={() => setOpenModel((value) => !value)}
      />

      <Disclosure
        label="Algorithm settings"
        open={openAlgorithm}
        onToggle={() => setOpenAlgorithm((value) => !value)}
      >
        <div className="row" style={{ gap: 26 }}>
          <div>
            <div className="field-label">
              Stop condition{" "}
              <Help text="Stop when the normalized multi-tube ensemble defect falls below this." />
            </div>
            <input
              type="text"
              value={stopCondition}
              onChange={(event) => setStopCondition(Number(event.target.value) || 0)}
              style={{ width: 60 }}
            />
          </div>
          <div>
            <div className="field-label">
              Max design time <Help text="Wall-clock budget in seconds." />
            </div>
            <input
              type="text"
              value={maxTime}
              onChange={(event) => setMaxTime(Number(event.target.value) || 1)}
              style={{ width: 60 }}
            />
          </div>
          <div>
            <div className="field-label">
              Random seed <Help text="A fixed seed reproduces a design run exactly." />
            </div>
            <input
              type="text"
              value={seed}
              onChange={(event) => setSeed(Number(event.target.value) || 0)}
              style={{ width: 60 }}
            />
          </div>
          <div>
            <div className="field-label">Wobble mutations</div>
            <RadioGroup
              name="wobble"
              value={wobble}
              onChange={setWobble}
              options={[
                { value: "allow", label: "Allow" },
                { value: "prohibit", label: "Prohibit" },
              ]}
            />
          </div>
        </div>
      </Disclosure>

      <div className="section-title">
        Domains <Help text="Design variables. Give a length (N12) or an IUPAC constraint string." />
      </div>
      <EditableTable
        columns={["Domain", "Sequence"]}
        rows={domains.map((domain) => [domain.name, domain.constraint])}
        widths={[140, 420]}
        onChange={(rowIndex, columnIndex, value) =>
          setDomains(
            domains.map((domain, index) =>
              index === rowIndex
                ? columnIndex === 0
                  ? { ...domain, name: value }
                  : { ...domain, constraint: value }
                : domain,
            ),
          )
        }
        onRemove={(rowIndex) => setDomains(domains.filter((_, index) => index !== rowIndex))}
        onAdd={() =>
          setDomains([...domains, { name: nextName("d", domains.map((d) => d.name)), constraint: "N6" }])
        }
        addLabel="Add Domain"
        monospaceColumns={[1]}
      />

      <div className="section-title">
        Strands <Help text="Domain order, 5' to 3'. Append * for a complemented domain." />
      </div>
      <EditableTable
        columns={["Strand", "Domain Order"]}
        rows={strands.map((strand) => [strand.name, strand.domains])}
        widths={[140, 420]}
        onChange={(rowIndex, columnIndex, value) =>
          setStrands(
            strands.map((strand, index) =>
              index === rowIndex
                ? columnIndex === 0
                  ? { ...strand, name: value }
                  : { ...strand, domains: value }
                : strand,
            ),
          )
        }
        onRemove={(rowIndex) => setStrands(strands.filter((_, index) => index !== rowIndex))}
        onAdd={() =>
          setStrands([...strands, { name: nextName("s", strands.map((s) => s.name)), domains: "" }])
        }
        addLabel="Add Strand"
      />

      <div className="section-title">
        Target complexes <Help text="Strand order and the target secondary structure." />
      </div>
      <EditableTable
        columns={["Target complex", "Strand order", "Target structure"]}
        rows={complexes.map((complex) => [complex.name, complex.strands, complex.structure])}
        widths={[130, 150, 420]}
        onChange={(rowIndex, columnIndex, value) =>
          setComplexes(
            complexes.map((complex, index) => {
              if (index !== rowIndex) return complex;
              if (columnIndex === 0) return { ...complex, name: value };
              if (columnIndex === 1) return { ...complex, strands: value };
              return { ...complex, structure: value };
            }),
          )
        }
        onRemove={(rowIndex) => setComplexes(complexes.filter((_, index) => index !== rowIndex))}
        onAdd={() =>
          setComplexes([
            ...complexes,
            { name: nextName("c", complexes.map((c) => c.name)), strands: "", structure: "" },
          ])
        }
        addLabel="Add Complex"
        monospaceColumns={[2]}
      />

      {tubes.map((tube, tubeIndex) => (
        <section className="card" key={tubeIndex}>
          <header>
            <strong style={{ fontSize: 13 }}>Target tube: {tube.name}</strong>
            {tubes.length > 1 && (
              <button
                className="btn-icon"
                type="button"
                onClick={() => setTubes(tubes.filter((_, index) => index !== tubeIndex))}
              >
                🗑
              </button>
            )}
          </header>
          <div className="field-label">Target Tube</div>
          <input
            type="text"
            value={tube.name}
            onChange={(event) =>
              setTubes(
                tubes.map((entry, index) =>
                  index === tubeIndex ? { ...entry, name: event.target.value } : entry,
                ),
              )
            }
            style={{ width: 220 }}
          />

          <div className="section-title">
            On-target complexes{" "}
            <Help text="Complexes that should form, with their target concentrations." />
          </div>
          <table className="grid" style={{ maxWidth: 520 }}>
            <thead>
              <tr>
                <th>On-target complex</th>
                <th style={{ width: 170 }}>Target concentration</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {tube.onTargets.map((entry, rowIndex) => (
                <tr key={rowIndex}>
                  <td>
                    <select
                      value={entry.complex}
                      onChange={(event) =>
                        setTubes(
                          tubes.map((t, index) =>
                            index === tubeIndex
                              ? {
                                  ...t,
                                  onTargets: t.onTargets.map((row, i) =>
                                    i === rowIndex ? { ...row, complex: event.target.value } : row,
                                  ),
                                }
                              : t,
                          ),
                        )
                      }
                      style={{ width: "100%" }}
                    >
                      <option value="">—</option>
                      {complexes.map((complex) => (
                        <option key={complex.name} value={complex.name}>
                          {complex.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <ConcentrationInput
                      amount={entry.amount}
                      unit={entry.unit}
                      onChange={(amount, unit) =>
                        setTubes(
                          tubes.map((t, index) =>
                            index === tubeIndex
                              ? {
                                  ...t,
                                  onTargets: t.onTargets.map((row, i) =>
                                    i === rowIndex ? { ...row, amount, unit } : row,
                                  ),
                                }
                              : t,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="btn-icon"
                      type="button"
                      onClick={() =>
                        setTubes(
                          tubes.map((t, index) =>
                            index === tubeIndex
                              ? { ...t, onTargets: t.onTargets.filter((_, i) => i !== rowIndex) }
                              : t,
                          ),
                        )
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
            onClick={() =>
              setTubes(
                tubes.map((t, index) =>
                  index === tubeIndex
                    ? {
                        ...t,
                        onTargets: [
                          ...t.onTargets,
                          { complex: complexes[0]?.name ?? "", amount: 1, unit: "uM" },
                        ],
                      }
                    : t,
                ),
              )
            }
          >
            ⊕ Add On target
          </button>

          <div className="section-title">
            Off-target complexes{" "}
            <Help text="Every other complex up to this size is designed against." />
          </div>
          <div>
            <span className="field-label">Max complex size</span>
            <input
              type="number"
              min={1}
              max={4}
              value={tube.maxComplexSize}
              onChange={(event) =>
                setTubes(
                  tubes.map((t, index) =>
                    index === tubeIndex
                      ? { ...t, maxComplexSize: Number(event.target.value) || 1 }
                      : t,
                  ),
                )
              }
              style={{ width: 56 }}
            />{" "}
            <span className="note">strands</span>
          </div>
        </section>
      ))}

      <button
        className="btn-quiet"
        type="button"
        onClick={() =>
          setTubes([
            ...tubes,
            {
              name: `Tube ${tubes.length + 1}`,
              onTargets: [{ complex: complexes[0]?.name ?? "", amount: 1, unit: "uM" }],
              maxComplexSize: 1,
            },
          ])
        }
      >
        ⊕ Add Tube
      </button>

      {error && <p className="error">{error}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
        <button
          className="btn-quiet"
          type="button"
          onClick={() => downloadJson("design-job.json", request)}
        >
          ⬇ Download job
        </button>
        <button className="btn" type="button" onClick={submit} disabled={busy}>
          {busy ? <span className="spin" /> : "Design"}
        </button>
      </div>
    </div>
  );
}

/** Demo links and the Utilities hand-off arrive as query parameters. */
function initialState(params: URLSearchParams | ReadonlyURLSearchParams) {
  const fallback = {
    model: DEFAULT_MODEL_INPUT,
    domains: [{ name: "a", constraint: "N6" }] as DomainDraft[],
    strands: [{ name: "s1", domains: "a" }] as StrandDraft[],
    complexes: [{ name: "c1", strands: "s1", structure: "" }] as ComplexDraft[],
    tubes: [
      {
        name: "Tube 1",
        onTargets: [{ complex: "c1", amount: 1, unit: "uM" }],
        maxComplexSize: 1,
      },
    ] as TubeDraft[],
    stopCondition: 0.05,
    maxTime: 60,
  };

  const demoId = params.get("demo");
  if (demoId) {
    const demo = DESIGN_DEMOS.find((entry) => entry.id === demoId);
    if (demo) {
      return {
        model: { ...DEFAULT_MODEL_INPUT, ...demo.model },
        domains: demo.domains,
        strands: demo.strands,
        complexes: demo.complexes,
        tubes: demo.tubes,
        stopCondition: demo.stopCondition,
        maxTime: demo.maxTime,
      };
    }
  }

  const structure = params.get("structure");
  if (structure) {
    const parts = structure.split("+");
    return {
      ...fallback,
      domains: parts.map((part, index) => ({
        name: `d${index + 1}`,
        constraint: `N${part.length}`,
      })),
      strands: parts.map((_, index) => ({
        name: `s${index + 1}`,
        domains: `d${index + 1}`,
      })),
      complexes: [
        {
          name: "target",
          strands: parts.map((_, index) => `s${index + 1}`).join(" "),
          structure,
        },
      ],
      tubes: [
        {
          name: "Tube 1",
          onTargets: [{ complex: "target", amount: 1, unit: "uM" }],
          maxComplexSize: Math.max(1, parts.length),
        },
      ],
    };
  }

  return fallback;
}

/** "N12" is shorthand for twelve unconstrained nucleotides. */
function expandConstraint(text: string): string {
  const compact = text.replace(/\s+/g, "").toUpperCase();
  if (/^\d+$/.test(compact)) return "N".repeat(Number(compact));
  return compact.replace(/([ACGTUNRYSWKMBDHV])(\d+)/g, (_, letter, count) =>
    letter.repeat(Number(count)),
  );
}

function nextName(prefix: string, existing: string[]): string {
  let index = existing.length + 1;
  while (existing.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

function EditableTable({
  columns,
  rows,
  widths,
  onChange,
  onRemove,
  onAdd,
  addLabel,
  monospaceColumns = [],
}: {
  columns: string[];
  rows: string[][];
  widths: number[];
  onChange: (rowIndex: number, columnIndex: number, value: string) => void;
  onRemove: (rowIndex: number) => void;
  onAdd: () => void;
  addLabel: string;
  monospaceColumns?: number[];
}) {
  return (
    <div>
      <table className="grid" style={{ maxWidth: widths.reduce((a, b) => a + b, 40) }}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column} style={{ width: widths[index] }}>
                {column}
              </th>
            ))}
            <th style={{ width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <td key={columnIndex}>
                  <input
                    type="text"
                    spellCheck={false}
                    className={monospaceColumns.includes(columnIndex) ? "seq-input" : undefined}
                    value={cell}
                    onChange={(event) => onChange(rowIndex, columnIndex, event.target.value)}
                  />
                </td>
              ))}
              <td>
                <button className="btn-icon" type="button" onClick={() => onRemove(rowIndex)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-quiet" type="button" onClick={onAdd}>
        ⊕ {addLabel}
      </button>
    </div>
  );
}
