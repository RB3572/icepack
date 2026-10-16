"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConcentrationInput, Disclosure, Help, RadioGroup } from "@/components/Controls";
import {
  DEFAULT_MODEL_INPUT,
  MaterialAndTemperature,
  ModelOptions,
} from "@/components/ModelOptions";
import { PairMatrix } from "@/components/viz/PairMatrix";
import {
  StructureDiagram,
  type BaseShading,
  type BaseStyle,
} from "@/components/viz/StructureDiagram";
import { downloadJson, downloadSvg } from "@/lib/client/download";
import { fromSparse, type ModelInput, type UtilitiesResponse } from "@/lib/nupack/job-types";

type View = "structure" | "pairs";

interface DesignSettings {
  constraints: string;
  stopCondition: number;
  maxTime: number;
  seed: number;
  wobble: "allow" | "prohibit";
}

const DEFAULT_DESIGN: DesignSettings = {
  constraints: "",
  stopCondition: 0.01,
  maxTime: 20,
  seed: 93,
  wobble: "allow",
};

export function UtilitiesClient() {
  return (
    <Suspense fallback={<p className="note">Loading…</p>}>
      <UtilitiesInner />
    </Suspense>
  );
}

function UtilitiesInner() {
  const params = useSearchParams();

  const initial = useMemo(
    () => ({
      model: {
        ...DEFAULT_MODEL_INPUT,
        material:
          (params.get("material") as ModelInput["material"]) ?? DEFAULT_MODEL_INPUT.material,
        celsius: params.get("celsius")
          ? Number(params.get("celsius"))
          : DEFAULT_MODEL_INPUT.celsius,
      },
      sequence: params.get("sequence") ?? "",
      structure: params.get("structure") ?? "",
    }),
    [params],
  );

  const [model, setModel] = useState<ModelInput>(initial.model);
  const [structure, setStructure] = useState(initial.structure);
  const [sequence, setSequence] = useState(initial.sequence);
  const [useMfe, setUseMfe] = useState(false);
  const [optimize, setOptimize] = useState(false);
  const [design, setDesign] = useState<DesignSettings>(DEFAULT_DESIGN);

  const [view, setView] = useState<View>("structure");
  const [baseStyle, setBaseStyle] = useState<BaseStyle>("circle");
  const [shading, setShading] = useState<BaseShading>("probability");
  const [showNumbers, setShowNumbers] = useState(false);
  const [showLetters, setShowLetters] = useState(false);
  const [topText, setTopText] = useState("Specified Structure");
  const [bottomText, setBottomText] = useState("");
  const [showSpecified, setShowSpecified] = useState(false);

  const [openDetails, setOpenDetails] = useState(false);
  const [openModel, setOpenModel] = useState(false);
  const [openDesign, setOpenDesign] = useState(false);

  const [result, setResult] = useState<UtilitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);

  const structureSvg = useRef<SVGSVGElement>(null);
  const matrixSvg = useRef<SVGSVGElement>(null);

  const update = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/utilities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: { ...model, wobble: design.wobble === "allow" ? model.wobble : false },
          sequence,
          structure,
          useMfe,
          optimize,
          constraints: design.constraints,
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error ?? "Calculation failed");
        setResult(null);
      } else {
        setResult(payload as UtilitiesResponse);
        if (payload.structureFreeEnergy !== null) {
          setBottomText(
            `Free energy of secondary structure: ${payload.structureFreeEnergy.toFixed(2)} kcal/mol`,
          );
        }
        if (useMfe || optimize) {
          setStructure(payload.structure);
          if (optimize) setSequence(payload.sequence);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, [model, sequence, structure, useMfe, optimize, design]);

  const matrix = useMemo(
    () => (result?.pairProbabilities ? fromSparse(result.pairProbabilities) : null),
    [result],
  );

  const hasStructure = (result?.pairs.length ?? 0) > 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <MaterialAndTemperature value={model} onChange={setModel} />
        <button className="btn" type="button" onClick={update} disabled={busy}>
          {busy ? <span className="spin" /> : "Update"}
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span className="field-label" style={{ marginBottom: 0 }}>
            Structure{" "}
            <Help text="Dot-parens-plus, RLE dot-parens-plus or DU+ notation. Use + for a strand break." />
          </span>
          <label style={{ fontSize: 12 }}>
            <input type="checkbox" checked={useMfe} onChange={(e) => setUseMfe(e.target.checked)} /> MFE{" "}
            <Help text="Replace the structure with the MFE structure of the sequence." />
          </label>
          <a href={`/design/input?structure=${encodeURIComponent(structure)}`}>→ To Design</a>
        </div>
        <textarea
          rows={3}
          value={structure}
          onChange={(event) => setStructure(event.target.value)}
          spellCheck={false}
          placeholder="((((....))))"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 20, marginTop: 10 }}>
        <div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <span className="field-label" style={{ marginBottom: 0 }}>
              Sequence <Help text="One or more strands separated by +." />
            </span>
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={optimize}
                onChange={(e) => setOptimize(e.target.checked)}
              />{" "}
              Optimize <Help text="Design a sequence for the specified structure." />
            </label>
            <a
              href={`/analysis/input?sequence=${encodeURIComponent(sequence)}&material=${model.material}&celsius=${model.celsius}`}
            >
              → To Analysis
            </a>
          </div>
          <textarea
            rows={3}
            value={sequence}
            onChange={(event) => setSequence(event.target.value)}
            spellCheck={false}
            placeholder="GCCGGUGCUGUU…"
          />
        </div>
        <div>
          <div className="field-label">
            Cursor <Help text="Position of the highlighted base." />
          </div>
          <div style={{ fontSize: 13 }}>{cursor === null ? sequence.replace(/[^A-Za-z]/g, "").length : cursor + 1}</div>
          {cursor !== null && result && (
            <div className="note">
              {result.sequence[cursor]}
              {result.stateProbabilities
                ? ` · p=${result.stateProbabilities[cursor].toFixed(3)}`
                : ""}
            </div>
          )}
        </div>
      </div>

      {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
      {result?.warnings.map((warning) => (
        <p key={warning} className="note" style={{ marginTop: 6 }}>
          {warning}
        </p>
      ))}

      <div style={{ marginTop: 14 }}>
        <RadioGroup
          name="view"
          value={view}
          onChange={setView}
          options={[
            { value: "structure", label: "Specified structure" },
            { value: "pairs", label: "Pair probabilities", disabled: !matrix },
          ]}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 230px", gap: 18, marginTop: 8 }}>
        <div className="card scroll-x" style={{ margin: 0 }}>
          {view === "structure" ? (
            <StructureSection
              svgRef={structureSvg}
              result={result}
              hasStructure={hasStructure}
              baseStyle={baseStyle}
              shading={shading}
              showNumbers={showNumbers}
              showLetters={showLetters}
              topText={topText}
              bottomText={bottomText}
              cursor={cursor}
              onHover={setCursor}
            />
          ) : (
            matrix &&
            result && (
              <PairMatrixSection
                svgRef={matrixSvg}
                result={result}
                matrix={matrix}
                celsius={model.celsius}
                overlay={showSpecified}
              />
            )
          )}
          <div style={{ display: "flex", gap: 20, justifyContent: "flex-end", marginTop: 6 }}>
            <button
              className="btn-quiet"
              type="button"
              onClick={() =>
                downloadSvg(
                  view === "structure" ? structureSvg.current : matrixSvg.current,
                  view === "structure" ? "structure.svg" : "pair-probabilities.svg",
                )
              }
            >
              ⬇ Download graphic
            </button>
            <button
              className="btn-quiet"
              type="button"
              disabled={!result}
              onClick={() => result && downloadJson("utilities-data.json", result)}
            >
              ⬇ Download data
            </button>
          </div>
        </div>

        <aside>
          {view === "structure" ? (
            <>
              <div className="field-label">
                Base style <Help text="Draw each nucleotide as a filled circle or a tick." />
              </div>
              <RadioGroup
                name="basestyle"
                inline={false}
                value={baseStyle}
                onChange={setBaseStyle}
                options={[
                  { value: "circle", label: "Circle" },
                  { value: "ticks", label: "Ticks" },
                ]}
              />
              <div className="field-label" style={{ marginTop: 10 }}>
                Base shading <Help text="Colour each nucleotide by equilibrium probability or by identity." />
              </div>
              <RadioGroup
                name="shading"
                inline={false}
                value={shading}
                onChange={setShading}
                options={[
                  { value: "probability", label: "Probability", disabled: !result?.stateProbabilities },
                  { value: "identity", label: "Identity", disabled: !result?.sequence },
                  { value: "none", label: "None" },
                ]}
              />
              <div className="field-label" style={{ marginTop: 10 }}>
                Annotation
              </div>
              <label style={{ fontSize: 12, display: "block" }}>
                <input
                  type="checkbox"
                  checked={showNumbers}
                  onChange={(e) => setShowNumbers(e.target.checked)}
                />{" "}
                Base number
              </label>
              <label style={{ fontSize: 12, display: "block" }}>
                <input
                  type="checkbox"
                  checked={showLetters}
                  onChange={(e) => setShowLetters(e.target.checked)}
                />{" "}
                Base letter
              </label>
              <div className="field-label" style={{ marginTop: 10 }}>
                Top text
              </div>
              <input
                type="text"
                value={topText}
                onChange={(event) => setTopText(event.target.value)}
                style={{ width: "100%" }}
              />
              <div className="field-label" style={{ marginTop: 8 }}>
                Bottom text
              </div>
              <input
                type="text"
                value={bottomText}
                onChange={(event) => setBottomText(event.target.value)}
                style={{ width: "100%" }}
              />
            </>
          ) : (
            <>
              <div className="field-label">Structure</div>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={showSpecified}
                  onChange={(event) => setShowSpecified(event.target.checked)}
                />{" "}
                Show specified structure
              </label>
            </>
          )}
        </aside>
      </div>

      <Disclosure label="Details" open={openDetails} onToggle={() => setOpenDetails((v) => !v)}>
        <Details result={result} />
      </Disclosure>

      <ModelOptions
        value={model}
        onChange={setModel}
        open={openModel}
        onToggle={() => setOpenModel((v) => !v)}
      />

      <Disclosure
        label="Design settings"
        open={openDesign}
        onToggle={() => setOpenDesign((v) => !v)}
      >
        <div className="row" style={{ gap: 26 }}>
          <div style={{ flex: "1 1 240px" }}>
            <div className="field-label">
              Sequence constraints <Help text="IUPAC codes, one character per nucleotide, + between strands." />
            </div>
            <input
              type="text"
              className="seq-input"
              value={design.constraints}
              onChange={(event) => setDesign({ ...design, constraints: event.target.value })}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <div className="field-label">
              Stop condition <Help text="Target normalized ensemble defect." />
            </div>
            <input
              type="text"
              value={design.stopCondition}
              onChange={(event) =>
                setDesign({ ...design, stopCondition: Number(event.target.value) || 0 })
              }
              style={{ width: 60 }}
            />
          </div>
          <div>
            <div className="field-label">
              Max design time <Help text="Wall-clock budget in seconds." />
            </div>
            <input
              type="text"
              value={design.maxTime}
              onChange={(event) =>
                setDesign({ ...design, maxTime: Number(event.target.value) || 1 })
              }
              style={{ width: 60 }}
            />
          </div>
          <div>
            <div className="field-label">
              Random seed <Help text="Seed for the mutation search; a fixed seed reproduces a run." />
            </div>
            <input
              type="text"
              value={design.seed}
              onChange={(event) => setDesign({ ...design, seed: Number(event.target.value) || 0 })}
              style={{ width: 60 }}
            />
          </div>
          <div>
            <div className="field-label">Wobble mutations</div>
            <RadioGroup
              name="wobble"
              value={design.wobble}
              onChange={(next) => setDesign({ ...design, wobble: next })}
              options={[
                { value: "allow", label: "Allow" },
                { value: "prohibit", label: "Prohibit" },
              ]}
            />
          </div>
        </div>
      </Disclosure>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="btn-quiet"
          type="button"
          onClick={() =>
            downloadJson("utilities-job.json", { model, sequence, structure, design })
          }
        >
          ⬇ Download job
        </button>
      </div>
    </div>
  );
}

function StructureSection({
  svgRef,
  result,
  hasStructure,
  baseStyle,
  shading,
  showNumbers,
  showLetters,
  topText,
  bottomText,
  cursor,
  onHover,
}: {
  svgRef: React.Ref<SVGSVGElement>;
  result: UtilitiesResponse | null;
  hasStructure: boolean;
  baseStyle: BaseStyle;
  shading: BaseShading;
  showNumbers: boolean;
  showLetters: boolean;
  topText: string;
  bottomText: string;
  cursor: number | null;
  onHover: (index: number | null) => void;
}) {
  if (!result || !hasStructure) {
    return (
      <div style={{ height: 320, display: "grid", placeItems: "center" }}>
        <p className="note">No possible structure</p>
      </div>
    );
  }
  return (
    <div>
      <StructureDiagram
        svgRef={svgRef}
        sequence={result.sequence}
        pairs={result.pairs}
        strandLengths={result.strandLengths}
        probabilities={result.stateProbabilities ?? undefined}
        baseStyle={baseStyle}
        shading={shading}
        showBaseNumbers={showNumbers}
        showBaseLetters={showLetters}
        topText={topText}
        bottomText={bottomText}
        cursor={cursor}
        onHoverBase={onHover}
        width={560}
        height={460}
      />
    </div>
  );
}

function PairMatrixSection({
  svgRef,
  result,
  matrix,
  celsius,
  overlay,
}: {
  svgRef: React.Ref<SVGSVGElement>;
  result: UtilitiesResponse;
  matrix: Float64Array;
  celsius: number;
  overlay: boolean;
}) {
  return (
    <div>
      <PairMatrix
        svgRef={svgRef}
        n={result.nucleotides}
        matrix={matrix}
        unpaired={result.unpaired ?? undefined}
        strandLengths={result.strandLengths}
        title={`Equilibrium base-pairing probabilities at ${celsius} °C`}
        caption={
          result.complexFreeEnergy !== null
            ? `Free energy of complex (-kT log Q): ${result.complexFreeEnergy.toFixed(2)} kcal/mol`
            : undefined
        }
        overlayPairs={overlay ? result.pairs : undefined}
      />
    </div>
  );
}

function Details({ result }: { result: UtilitiesResponse | null }) {
  if (!result) return <p className="note">Run an update to see complex properties.</p>;
  const number = (value: number | null, digits = 2, suffix = "") =>
    value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}${suffix}`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
      <div>
        <div className="section-title" style={{ marginTop: 0 }}>
          Properties of complex ensemble
        </div>
        <dl className="kv">
          <dt>Strands:</dt>
          <dd>{result.strandCount} strands</dd>
          <dt>Nucleotides:</dt>
          <dd>{result.nucleotides} nt</dd>
          <dt>Complex free energy:</dt>
          <dd>{number(result.complexFreeEnergy, 2, " kcal/mol")}</dd>
          <dt>Ensemble size:</dt>
          <dd>
            {result.ensembleSize === null
              ? "—"
              : result.ensembleSize < 1e15
                ? result.ensembleSize.toLocaleString()
                : `10^${(result.ensembleSizeLog10 ?? 0).toFixed(2)}`}
          </dd>
        </dl>
        <table className="grid" style={{ marginTop: 10, maxWidth: 220 }}>
          <thead>
            <tr>
              <th>Base</th>
              <th>Count</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {result.baseCounts.map((entry) => (
              <tr key={entry.base}>
                <td>{entry.base}</td>
                <td>{entry.count}</td>
                <td>{entry.percent.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="section-title" style={{ marginTop: 0 }}>
          Structure properties within complex ensemble
        </div>
        <dl className="kv">
          <dt>Structure free energy:</dt>
          <dd>{number(result.structureFreeEnergy, 2, " kcal/mol")}</dd>
          <dt>Equilibrium probability:</dt>
          <dd>
            {result.probability === null ? "—" : result.probability.toPrecision(3)}
          </dd>
          <dt>Ensemble defect:</dt>
          <dd>{number(result.ensembleDefect, 2, " nt")}</dd>
          <dt>Normalized ensemble defect:</dt>
          <dd>
            {result.normalizedEnsembleDefect === null
              ? "—"
              : `${(result.normalizedEnsembleDefect * 100).toFixed(2)} %`}
          </dd>
          <dt>MFE free energy:</dt>
          <dd>{number(result.mfeEnergy, 2, " kcal/mol")}</dd>
        </dl>
        {result.mfeStructure && (
          <div style={{ marginTop: 8 }}>
            <div className="field-label">MFE structure</div>
            <code style={{ fontSize: 11, wordBreak: "break-all" }}>{result.mfeStructure}</code>
          </div>
        )}
      </div>
    </div>
  );
}

export { ConcentrationInput };
