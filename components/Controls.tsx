"use client";

import { useId, useState } from "react";

export function Help({ text }: { text: string }) {
  return (
    <span className="help" title={text} aria-label={text} role="img">
      ?
    </span>
  );
}

export function Disclosure({
  label,
  open,
  onToggle,
  children,
  right,
}: {
  label: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const id = useId();
  return (
    <section style={{ margin: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          className="disclosure"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
        >
          <span className="caret">{open ? "▼" : "▶"}</span>
          {label}
        </button>
        {right}
      </div>
      {open && (
        <div id={id} style={{ paddingLeft: 16 }}>
          {children}
        </div>
      )}
    </section>
  );
}

export function RadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
  inline = true,
}: {
  name: string;
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (next: T) => void;
  inline?: boolean;
}) {
  return (
    <div style={{ display: inline ? "flex" : "block", gap: 18, flexWrap: "wrap" }}>
      {options.map((option) => (
        <label
          key={option.value}
          style={{
            fontSize: 12,
            display: inline ? "inline-flex" : "flex",
            alignItems: "center",
            gap: 4,
            color: option.disabled ? "#a9a9a9" : undefined,
          }}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/** Concentration input with a unit selector, mirroring the tube forms. */
const UNITS: Array<{ value: string; label: string; factor: number }> = [
  { value: "M", label: "M", factor: 1 },
  { value: "mM", label: "mM", factor: 1e-3 },
  { value: "uM", label: "µM", factor: 1e-6 },
  { value: "nM", label: "nM", factor: 1e-9 },
  { value: "pM", label: "pM", factor: 1e-12 },
];

export function unitFactor(unit: string): number {
  return UNITS.find((entry) => entry.value === unit)?.factor ?? 1;
}

export function ConcentrationInput({
  amount,
  unit,
  onChange,
  width = 64,
}: {
  amount: number;
  unit: string;
  onChange: (amount: number, unit: string) => void;
  width?: number;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(event) => onChange(Number(event.target.value) || 0, unit)}
        style={{ width }}
      />
      <select value={unit} onChange={(event) => onChange(amount, event.target.value)}>
        {UNITS.map((entry) => (
          <option key={entry.value} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function useToggle(initial = false): [boolean, () => void] {
  const [open, setOpen] = useState(initial);
  return [open, () => setOpen((value) => !value)];
}
