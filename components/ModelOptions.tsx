"use client";

import { ENSEMBLE_LABELS, type EnsembleName } from "@/lib/nupack/model";
import type { ModelInput } from "@/lib/nupack/job-types";
import type { Material } from "@/lib/nupack/alphabet";
import { Disclosure, Help } from "./Controls";

export const MATERIALS: Array<{ value: Material; label: string }> = [
  { value: "rna", label: "RNA" },
  { value: "dna", label: "DNA" },
  { value: "2ome-rna", label: "2'OMe-RNA" },
];

export const PARAMETER_SETS: Record<string, string[]> = {
  rna: ["rna06", "rna95"],
  dna: ["dna04"],
  "2ome-rna": ["rna06"],
};

const ENSEMBLES: EnsembleName[] = [
  "stacking",
  "nostacking",
  "coaxial",
  "dangles",
  "some-nupack3",
  "none-nupack3",
  "all-nupack3",
];

export const DEFAULT_MODEL_INPUT: ModelInput = {
  material: "rna",
  celsius: 37,
  ensemble: "stacking",
  sodium: 1,
  magnesium: 0,
  wobble: undefined,
};

export function MaterialAndTemperature({
  value,
  onChange,
  extra,
}: {
  value: ModelInput;
  onChange: (next: ModelInput) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="row">
      <div>
        <div className="field-label">
          Material <Help text="Single-material job: RNA, DNA or 2'OMe-RNA." />
        </div>
        <select
          value={value.material}
          onChange={(event) =>
            onChange({ ...value, material: event.target.value as Material })
          }
          style={{ width: 150 }}
        >
          <optgroup label="Single-material">
            {MATERIALS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div>
        <div className="field-label">
          Temperature <Help text="Temperature at which the ensemble is evaluated." />
        </div>
        <span>
          <input
            type="text"
            inputMode="decimal"
            value={value.celsius}
            onChange={(event) =>
              onChange({ ...value, celsius: Number(event.target.value) || 0 })
            }
            style={{ width: 56 }}
          />{" "}
          <span className="note">&deg;C</span>
        </span>
      </div>
      {extra}
    </div>
  );
}

export function ModelOptions({
  value,
  onChange,
  open,
  onToggle,
}: {
  value: ModelInput;
  onChange: (next: ModelInput) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const sets = PARAMETER_SETS[value.material] ?? ["rna06"];
  return (
    <Disclosure label="Model options" open={open} onToggle={onToggle}>
      <div className="row" style={{ gap: 30 }}>
        <div>
          <div className="field-label">
            Parameters <Help text="Nearest-neighbour parameter set used for loop energies." />
          </div>
          <select
            value={value.parameterSet ?? sets[0]}
            onChange={(event) => onChange({ ...value, parameterSet: event.target.value })}
            style={{ width: 140 }}
          >
            {sets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="field-label">
            Ensemble <Help text="How terminal mismatches, dangles and coaxial stacks are treated." />
          </div>
          <select
            value={value.ensemble}
            onChange={(event) =>
              onChange({ ...value, ensemble: event.target.value as EnsembleName })
            }
            style={{ width: 190 }}
          >
            {ENSEMBLES.map((name) => (
              <option key={name} value={name}>
                {ENSEMBLE_LABELS[name]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="field-label">
            Salts <Help text="Na+ and Mg++ concentrations; the correction applies to DNA." />
          </div>
          <span>
            <input
              type="text"
              value={value.sodium}
              onChange={(event) => onChange({ ...value, sodium: Number(event.target.value) || 0 })}
              style={{ width: 52 }}
            />{" "}
            <span className="note">M Na&#8314;</span>{" "}
            <input
              type="text"
              value={value.magnesium}
              onChange={(event) =>
                onChange({ ...value, magnesium: Number(event.target.value) || 0 })
              }
              style={{ width: 52 }}
            />{" "}
            <span className="note">M Mg&#8314;&#8314;</span>
          </span>
        </div>
        <div>
          <div className="field-label">
            Wobble pairs <Help text="Allow G.U (G.T) pairs. The DNA nearest-neighbour model treats G.T as a mismatch, so it is off by default for DNA." />
          </div>
          <label style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={value.wobble ?? value.material !== "dna"}
              onChange={(event) => onChange({ ...value, wobble: event.target.checked })}
            />{" "}
            allow
          </label>
        </div>
      </div>
      {value.material === "2ome-rna" && (
        <p className="note" style={{ marginTop: 8 }}>
          2&apos;OMe-RNA is evaluated with the RNA parameter set; no published
          2&apos;OMe nearest-neighbour tables ship with this build.
        </p>
      )}
    </Disclosure>
  );
}
