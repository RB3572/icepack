"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Disclosure, Help } from "@/components/Controls";
import { BarChart, LinePlot } from "@/components/viz/Plots";
import { PairMatrix } from "@/components/viz/PairMatrix";
import { StructureDiagram } from "@/components/viz/StructureDiagram";
import { downloadJson, downloadText } from "@/lib/client/download";
import { fromSparse, type AnalysisResult } from "@/lib/nupack/job-types";
import { parseStructure } from "@/lib/nupack/structure";

export function AnalysisResults({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<"running" | "done" | "error">("running");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temperatureIndex, setTemperatureIndex] = useState(0);
  const [tubeIndex, setTubeIndex] = useState(0);
  const [complexIndex, setComplexIndex] = useState<number | null>(null);
  const [openMelt, setOpenMelt] = useState(true);
  const [openConcentrations, setOpenConcentrations] = useState(true);
  const [openPairs, setOpenPairs] = useState(false);
  const [hideDilute, setHideDilute] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await fetch(`/api/analysis?id=${jobId}`);
        const payload = await response.json();
        if (cancelled) return;
        if (!payload.ok) {
          setStatus("error");
          setError(payload.error);
          return;
        }
        if (payload.status === "done") {
          setResult(payload.result as AnalysisResult);
          setStatus("done");
          return;
        }
        if (payload.status === "error") {
          setStatus("error");
          setError(payload.error);
          return;
        }
        timer = setTimeout(poll, 900);
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

  const temperatures = result?.temperatures ?? [];
  const current = temperatures[Math.min(temperatureIndex, temperatures.length - 1)];
  const tube = current?.tubes[tubeIndex];

  const meltSeries = useMemo(() => {
    if (!result || !result.melt) return [];
    const tubeCount = result.temperatures[0]?.tubes.length ?? 0;
    return Array.from({ length: tubeCount }, (_, index) => ({
      name: result.temperatures[0].tubes[index].name,
      points: result.temperatures.map((entry) => ({
        x: entry.celsius,
        y: entry.tubes[index].fractionUnpaired,
      })),
    }));
  }, [result]);

  const visibleComplexes = useMemo(() => {
    if (!tube) return [];
    const maximum = Math.max(...tube.complexes.map((entry) => entry.concentration), 0);
    return tube.complexes
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !hideDilute || entry.concentration >= maximum * 1e-4);
  }, [tube, hideDilute]);

  if (status === "running") {
    return (
      <p className="note">
        <span className="spin" /> Running the analysis. Partition functions,
        concentrations and pair probabilities are computed for every complex in every
        tube{result?.melt ? " at every temperature" : ""}.
      </p>
    );
  }
  if (status === "error" || !result || !current || !tube) {
    return (
      <div>
        <p className="error">{error ?? "The job could not be found."}</p>
        <p>
          <Link href="/analysis/input">Back to input</Link>
        </p>
      </div>
    );
  }

  const selected = complexIndex === null ? null : tube.complexes[complexIndex];

  return (
    <div>
      {result.melt && (
        <div style={{ marginBottom: 14 }}>
          <div className="field-label" style={{ justifyContent: "center" }}>
            Temperature {current.celsius.toFixed(1)} °C{" "}
            <Help text="Drag to inspect the tube at each temperature in the melt." />
          </div>
          <input
            type="range"
            min={0}
            max={temperatures.length - 1}
            value={temperatureIndex}
            onChange={(event) => {
              setTemperatureIndex(Number(event.target.value));
              setComplexIndex(null);
            }}
            style={{ width: "100%" }}
          />
        </div>
      )}

      <div className="row" style={{ marginBottom: 6 }}>
        <div>
          <span className="note">Tube: </span>
          <select
            value={tubeIndex}
            onChange={(event) => {
              setTubeIndex(Number(event.target.value));
              setComplexIndex(null);
            }}
          >
            {current.tubes.map((entry, index) => (
              <option key={entry.name} value={index}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="note">
          computed in {(result.elapsedMs / 1000).toFixed(1)} s
          {!tube.converged && " · concentration solve did not fully converge"}
        </div>
      </div>

      {result.melt && (
        <Disclosure
          label={
            <span>
              Melt profile <Help text="Fraction of nucleotides unpaired in the tube ensemble." />
            </span>
          }
          open={openMelt}
          onToggle={() => setOpenMelt((value) => !value)}
          right={
            <button
              className="btn-quiet"
              type="button"
              onClick={() =>
                downloadText(
                  "melt.csv",
                  ["temperature_C," + meltSeries.map((s) => s.name).join(",")]
                    .concat(
                      result.temperatures.map((entry, index) =>
                        [entry.celsius, ...meltSeries.map((s) => s.points[index].y)].join(","),
                      ),
                    )
                    .join("\n"),
                  "text/csv",
                )
              }
            >
              ⬇ Download data
            </button>
          }
        >
          <LinePlot
            series={meltSeries}
            xLabel="Temperature (°C)"
            yLabel="Fraction of bases unpaired"
            width={620}
            height={300}
            yMin={0}
            yMax={1}
            marker={current.celsius}
            onPick={(value) => {
              let best = 0;
              let bestDistance = Infinity;
              temperatures.forEach((entry, index) => {
                const distance = Math.abs(entry.celsius - value);
                if (distance < bestDistance) {
                  bestDistance = distance;
                  best = index;
                }
              });
              setTemperatureIndex(best);
              setComplexIndex(null);
            }}
          />
        </Disclosure>
      )}

      <Disclosure
        label={
          <span>
            Equilibrium complex concentrations{" "}
            <Help text="Concentration of each complex at equilibrium. Click a bar for structural detail." />
          </span>
        }
        open={openConcentrations}
        onToggle={() => setOpenConcentrations((value) => !value)}
        right={
          <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <label className="note">
              <input
                type="checkbox"
                checked={hideDilute}
                onChange={(event) => setHideDilute(event.target.checked)}
              />{" "}
              hide vanishing complexes
            </label>
            <button
              className="btn-quiet"
              type="button"
              onClick={() =>
                downloadText(
                  "concentrations.csv",
                  ["complex,concentration_M,free_energy_kcal_per_mol"]
                    .concat(
                      tube.complexes.map((entry) =>
                        [entry.name, entry.concentration, entry.freeEnergy].join(","),
                      ),
                    )
                    .join("\n"),
                  "text/csv",
                )
              }
            >
              ⬇ Download data
            </button>
          </span>
        }
      >
        <div className="scroll-x">
          <BarChart
            rows={visibleComplexes.map(({ entry, index }) => ({
              label: entry.name,
              value: entry.concentration,
              highlight: index === complexIndex,
            }))}
            xLabel="Concentration (M)"
            width={660}
            onPick={(row) => setComplexIndex(visibleComplexes[row].index)}
            format={(value) => formatMolar(value)}
          />
        </div>
        <p className="note" style={{ marginTop: 4 }}>
          Fraction of nucleotides unpaired in this tube: {tube.fractionUnpaired.toFixed(4)}
        </p>
      </Disclosure>

      {selected && (
        <section className="card">
          <header>
            <strong style={{ fontSize: 13 }}>
              {selected.name}
              <span className="note" style={{ fontWeight: 400 }}>
                {"  "}
                {selected.length} nt · ΔG = {selected.freeEnergy.toFixed(2)} kcal/mol ·{" "}
                {formatMolar(selected.concentration)}
              </span>
            </strong>
            <button className="btn-icon" type="button" onClick={() => setComplexIndex(null)}>
              ✕
            </button>
          </header>
          {selected.mfeStructure ? (
            <ComplexDetail complex={selected} celsius={current.celsius} />
          ) : (
            <p className="note">
              This complex is too dilute to be worth a structural calculation; raise the
              concentrations or disable &ldquo;hide vanishing complexes&rdquo; to inspect it.
            </p>
          )}
        </section>
      )}

      <Disclosure
        label={
          <span>
            Tube ensemble pair fractions{" "}
            <Help text="Concentration-weighted pairing of every nucleotide across all complexes." />
          </span>
        }
        open={openPairs}
        onToggle={() => setOpenPairs((value) => !value)}
      >
        <TubeFractions tube={tube} strandNames={result.strandNames} celsius={current.celsius} />
      </Disclosure>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <Link href="/analysis/input">← Back to input</Link>
        <button
          className="btn-quiet"
          type="button"
          onClick={() => downloadJson("analysis-results.json", result)}
        >
          ⬇ Download job
        </button>
      </div>
    </div>
  );
}

function ComplexDetail({
  complex,
  celsius,
}: {
  complex: AnalysisResult["temperatures"][number]["tubes"][number]["complexes"][number];
  celsius: number;
}) {
  const parsed = useMemo(
    () => (complex.mfeStructure ? parseStructure(complex.mfeStructure) : null),
    [complex.mfeStructure],
  );
  const matrix = useMemo(
    () => (complex.pairProbabilities ? fromSparse(complex.pairProbabilities) : null),
    [complex.pairProbabilities],
  );
  const sequence = complex.sequence.replace(/\+/g, "");
  const probabilities = useMemo(() => {
    if (!parsed || !matrix || !complex.unpaired) return undefined;
    const n = sequence.length;
    return Array.from({ length: n }, (_, i) => {
      const partner = parsed.pairs[i];
      return partner < 0 ? complex.unpaired![i] : matrix[i * n + partner];
    });
  }, [parsed, matrix, complex.unpaired, sequence.length]);

  if (!parsed) return null;

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <div>
        <StructureDiagram
          sequence={sequence}
          pairs={Array.from(parsed.pairs)}
          strandLengths={complex.strandLengths}
          probabilities={probabilities}
          topText={`MFE structure at ${celsius.toFixed(1)} °C`}
          bottomText={
            complex.mfeEnergy !== null
              ? `Free energy of secondary structure: ${complex.mfeEnergy.toFixed(2)} kcal/mol`
              : undefined
          }
          width={520}
          height={420}
        />
      </div>
      {matrix && (
        <div className="scroll-x">
          <PairMatrix
            n={sequence.length}
            matrix={matrix}
            unpaired={complex.unpaired ?? undefined}
            strandLengths={complex.strandLengths}
            strandNames={complex.order}
            title={`Equilibrium base-pairing probabilities at ${celsius.toFixed(1)} °C`}
            caption={`Free energy of complex: ${complex.freeEnergy.toFixed(2)} kcal/mol`}
            size={360}
          />
        </div>
      )}
      <div style={{ flexBasis: "100%" }}>
        <div className="field-label">MFE structure</div>
        <code style={{ fontSize: 11, wordBreak: "break-all" }}>{complex.mfeStructure}</code>
        <div className="field-label" style={{ marginTop: 6 }}>
          Sequence
        </div>
        <code style={{ fontSize: 11, wordBreak: "break-all" }}>{complex.sequence}</code>
      </div>
    </div>
  );
}

function TubeFractions({
  tube,
  strandNames,
  celsius,
}: {
  tube: AnalysisResult["temperatures"][number]["tubes"][number];
  strandNames: string[];
  celsius: number;
}) {
  // Aggregate each strand species' per-nucleotide unpaired fraction across the
  // complexes it appears in, weighted by concentration.
  const data = useMemo(() => {
    const lengths = new Map<string, number>();
    for (const complex of tube.complexes) {
      complex.order.forEach((name, index) => {
        lengths.set(name, complex.strandLengths[index]);
      });
    }
    const names = strandNames.filter((name) => lengths.has(name));
    const totals = new Map<string, number>();
    const unpaired = new Map<string, Float64Array>();
    for (const name of names) {
      unpaired.set(name, new Float64Array(lengths.get(name) ?? 0));
      totals.set(name, 0);
    }
    for (const complex of tube.complexes) {
      if (!complex.unpaired) continue;
      let offset = 0;
      complex.order.forEach((name, index) => {
        const length = complex.strandLengths[index];
        const target = unpaired.get(name);
        if (target) {
          for (let k = 0; k < length; k++) target[k] += complex.concentration * complex.unpaired![offset + k];
          totals.set(name, (totals.get(name) ?? 0) + complex.concentration);
        }
        offset += length;
      });
    }
    return names.map((name) => {
      const values = unpaired.get(name)!;
      const total = totals.get(name) ?? 0;
      return {
        name,
        points: Array.from(values, (value, index) => ({
          x: index + 1,
          y: total > 0 ? value / total : 0,
        })),
      };
    });
  }, [tube, strandNames]);

  if (data.length === 0) return <p className="note">No structural data at this temperature.</p>;

  return (
    <div className="scroll-x">
      <LinePlot
        series={data}
        xLabel="Nucleotide index"
        yLabel="Fraction unpaired"
        width={640}
        height={280}
        yMin={0}
        yMax={1}
      />
      <p className="note">
        Concentration-weighted probability that each nucleotide of each strand species is
        unpaired at {celsius.toFixed(1)} °C, across every complex it belongs to.
      </p>
    </div>
  );
}

function formatMolar(value: number): string {
  if (value <= 0) return "0";
  const units: Array<[number, string]> = [
    [1, "M"],
    [1e-3, "mM"],
    [1e-6, "µM"],
    [1e-9, "nM"],
    [1e-12, "pM"],
  ];
  for (const [factor, label] of units) {
    if (value >= factor) return `${(value / factor).toPrecision(3)} ${label}`;
  }
  return value.toExponential(2);
}
