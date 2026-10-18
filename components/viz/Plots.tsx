"use client";

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface LinePlotProps {
  series: Array<{ name: string; points: SeriesPoint[]; color?: string }>;
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
  yMin?: number;
  yMax?: number;
  /** Highlights the point at this x value. */
  marker?: number | null;
  onPick?: (x: number) => void;
}

// Brand blues lead; the rest keep multi-series melts distinguishable.
const PALETTE = ["#2176ae", "#5fb6e0", "#c7452f", "#5b8f3f", "#8a5bbf", "#d08a1e"];

export function LinePlot({
  series,
  xLabel,
  yLabel,
  width = 420,
  height = 280,
  yMin,
  yMax,
  marker = null,
  onPick,
}: LinePlotProps) {
  const left = 52;
  const right = series.length > 1 ? 110 : 16;
  const top = 14;
  const bottom = 46;
  const plotW = width - left - right;
  const plotH = height - top - bottom;

  const xs = series.flatMap((entry) => entry.points.map((point) => point.x));
  const ys = series.flatMap((entry) => entry.points.map((point) => point.y));
  if (xs.length === 0) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="#6d6d6d">
          No data
        </text>
      </svg>
    );
  }
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = yMin ?? Math.min(0, ...ys);
  const y1 = yMax ?? (Math.max(...ys) * 1.05 || 1);

  const px = (value: number) => left + ((value - x0) / (x1 - x0 || 1)) * plotW;
  const py = (value: number) => top + plotH - ((value - y0) / (y1 - y0 || 1)) * plotH;

  const xTicks = niceTicks(x0, x1, 6);
  const yTicks = niceTicks(y0, y1, 5);

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`${yLabel} versus ${xLabel}`}
      onClick={(event) => {
        if (!onPick) return;
        const box = (event.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
        if (!box) return;
        const value = x0 + ((event.clientX - box.left - left) / (plotW || 1)) * (x1 - x0);
        onPick(value);
      }}
      style={{ cursor: onPick ? "crosshair" : "default" }}
    >
      <rect x={left} y={top} width={plotW} height={plotH} fill="#fff" stroke="#bdbdbd" />
      <g stroke="#ededed" strokeWidth={0.6}>
        {xTicks.map((value) => (
          <line key={`gx${value}`} x1={px(value)} y1={top} x2={px(value)} y2={top + plotH} />
        ))}
        {yTicks.map((value) => (
          <line key={`gy${value}`} x1={left} y1={py(value)} x2={left + plotW} y2={py(value)} />
        ))}
      </g>

      {series.map((entry, index) => {
        const color = entry.color ?? PALETTE[index % PALETTE.length];
        const path = entry.points
          .map((point, i) => `${i === 0 ? "M" : "L"}${px(point.x).toFixed(2)},${py(point.y).toFixed(2)}`)
          .join(" ");
        return (
          <g key={entry.name}>
            <path d={path} fill="none" stroke={color} strokeWidth={1.2} opacity={0.75} />
            {entry.points.map((point, i) => (
              <circle
                key={i}
                cx={px(point.x)}
                cy={py(point.y)}
                r={marker !== null && Math.abs(point.x - marker) < 1e-6 ? 5 : 3}
                fill={marker !== null && Math.abs(point.x - marker) < 1e-6 ? "#0d3d5c" : color}
              >
                <title>{`${point.x} , ${point.y.toFixed(4)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      <g fontSize={9} fill="#2f2f2f">
        {xTicks.map((value) => (
          <text key={`tx${value}`} x={px(value)} y={top + plotH + 13} textAnchor="middle">
            {formatTick(value)}
          </text>
        ))}
        {yTicks.map((value) => (
          <text key={`ty${value}`} x={left - 6} y={py(value) + 3} textAnchor="end">
            {formatTick(value)}
          </text>
        ))}
      </g>
      <text x={left + plotW / 2} y={height - 10} textAnchor="middle" fontSize={11}>
        {xLabel}
      </text>
      <text
        transform={`translate(14, ${top + plotH / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={11}
      >
        {yLabel}
      </text>

      {series.length > 1 && (
        <g fontSize={10}>
          {series.map((entry, index) => (
            <g key={entry.name} transform={`translate(${left + plotW + 10}, ${top + 12 + index * 15})`}>
              <rect width={9} height={9} y={-8} fill={entry.color ?? PALETTE[index % PALETTE.length]} />
              <text x={13} y={0} fill="#2f2f2f">
                {entry.name}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

export interface BarRow {
  label: string;
  value: number;
  highlight?: boolean;
}

export function BarChart({
  rows,
  xLabel,
  width = 640,
  rowHeight = 17,
  onPick,
  format = (value: number) => value.toPrecision(3),
}: {
  rows: BarRow[];
  xLabel: string;
  width?: number;
  rowHeight?: number;
  onPick?: (index: number) => void;
  format?: (value: number) => string;
}) {
  const left = 108;
  const right = 86;
  const top = 8;
  const bottom = 34;
  const plotW = width - left - right;
  const height = top + rows.length * rowHeight + bottom;
  const max = Math.max(1e-30, ...rows.map((row) => row.value));
  const ticks = niceTicks(0, max, 5);

  return (
    <svg width={width} height={height} role="img" aria-label={xLabel}>
      <g stroke="#ededed">
        {ticks.map((value) => (
          <line
            key={value}
            x1={left + (value / max) * plotW}
            y1={top}
            x2={left + (value / max) * plotW}
            y2={top + rows.length * rowHeight}
          />
        ))}
      </g>
      {rows.map((row, index) => {
        const barWidth = Math.max(0, (row.value / max) * plotW);
        return (
          <g
            key={row.label}
            transform={`translate(0, ${top + index * rowHeight})`}
            onClick={() => onPick?.(index)}
            style={{ cursor: onPick ? "pointer" : "default" }}
          >
            <rect x={0} y={0} width={width} height={rowHeight} fill="transparent" />
            <text x={left - 6} y={rowHeight * 0.72} textAnchor="end" fontSize={10} fill="#2f2f2f">
              {row.label}
            </text>
            <rect
              x={left}
              y={2}
              width={barWidth}
              height={rowHeight - 5}
              fill={row.highlight ? "#15577f" : "#8fd0ee"}
            />
            <text x={left + barWidth + 5} y={rowHeight * 0.72} fontSize={9} fill="#6d6d6d">
              {format(row.value)}
            </text>
          </g>
        );
      })}
      <g fontSize={9} fill="#2f2f2f">
        {ticks.map((value) => (
          <text
            key={`t${value}`}
            x={left + (value / max) * plotW}
            y={top + rows.length * rowHeight + 13}
            textAnchor="middle"
          >
            {formatTick(value)}
          </text>
        ))}
      </g>
      <text x={left + plotW / 2} y={height - 8} textAnchor="middle" fontSize={11}>
        {xLabel}
      </text>
    </svg>
  );
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const raw = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const step =
    (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let value = start; value <= max + step * 1e-6; value += step) {
    out.push(Number(value.toFixed(10)));
  }
  return out;
}

function formatTick(value: number): string {
  if (value === 0) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 1000 || absolute < 0.001) return value.toExponential(0);
  return String(Number(value.toFixed(4)));
}
