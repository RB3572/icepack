"use client";

import { useMemo } from "react";
import { probabilityColor } from "./colormap";
import { ColorBar } from "./StructureDiagram";

export interface PairMatrixProps {
  n: number;
  /** Row-major n x n matrix of pair probabilities. */
  matrix: Float64Array | number[];
  /** Probability that each base is unpaired, drawn as the strip on the right. */
  unpaired?: Float64Array | number[];
  strandLengths?: number[];
  strandNames?: string[];
  title?: string;
  caption?: string;
  size?: number;
  /** Optional overlay: pairs of a specified structure, drawn as outlines. */
  overlayPairs?: number[];
  threshold?: number;
  svgRef?: React.Ref<SVGSVGElement>;
}

export function PairMatrix({
  n,
  matrix,
  unpaired,
  strandLengths,
  strandNames,
  title,
  caption,
  size = 420,
  overlayPairs,
  threshold = 1e-4,
  svgRef,
}: PairMatrixProps) {
  const marginLeft = 46;
  const marginTop = title ? 34 : 14;
  const marginRight = 110;
  const marginBottom = caption ? 56 : 40;
  const stripGap = 6;
  const stripWidth = 10;
  const plot = size;
  const width = marginLeft + plot + stripGap + stripWidth + marginRight;
  const height = marginTop + plot + marginBottom;
  const cell = plot / Math.max(1, n);

  const cells = useMemo(() => {
    const out: Array<{ i: number; j: number; p: number }> = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const p = matrix[i * n + j];
        if (p > threshold) out.push({ i, j, p });
      }
    }
    return out;
  }, [matrix, n, threshold]);

  const ticks = useMemo(() => {
    const step = n <= 20 ? 5 : n <= 60 ? 10 : n <= 150 ? 20 : Math.ceil(n / 8 / 10) * 10;
    const out: number[] = [];
    for (let value = step; value <= n; value += step) out.push(value);
    return out;
  }, [n]);

  const boundaries = useMemo(() => {
    if (!strandLengths || strandLengths.length < 2) return [];
    const out: number[] = [];
    let running = 0;
    for (let i = 0; i < strandLengths.length - 1; i++) {
      running += strandLengths[i];
      out.push(running);
    }
    return out;
  }, [strandLengths]);

  const x = (index: number) => marginLeft + index * cell;
  const y = (index: number) => marginTop + index * cell;

  return (
    <svg ref={svgRef} width={width} height={height} role="img" aria-label="Pair probability matrix">
      {title && (
        <text x={marginLeft + plot / 2} y={18} textAnchor="middle" fontSize={12} fill="#2f2f2f">
          {title}
        </text>
      )}

      <rect
        x={marginLeft}
        y={marginTop}
        width={plot}
        height={plot}
        fill="#ffffff"
        stroke="#bdbdbd"
      />

      {/* gridlines */}
      <g stroke="#ededed" strokeWidth={0.5}>
        {ticks.map((value) => (
          <g key={`g${value}`}>
            <line x1={x(value)} y1={marginTop} x2={x(value)} y2={marginTop + plot} />
            <line x1={marginLeft} y1={y(value)} x2={marginLeft + plot} y2={y(value)} />
          </g>
        ))}
      </g>

      {/* diagonal */}
      <line
        x1={marginLeft}
        y1={marginTop}
        x2={marginLeft + plot}
        y2={marginTop + plot}
        stroke="#9a9a9a"
        strokeWidth={0.6}
      />

      {/* both triangles, so the matrix reads symmetrically */}
      <g>
        {cells.map(({ i, j, p }) => (
          <g key={`${i}-${j}`}>
            <rect
              x={x(j)}
              y={y(i)}
              width={Math.max(1.2, cell)}
              height={Math.max(1.2, cell)}
              fill={probabilityColor(p)}
            >
              <title>{`${i + 1} . ${j + 1}  p=${p.toFixed(4)}`}</title>
            </rect>
            <rect
              x={x(i)}
              y={y(j)}
              width={Math.max(1.2, cell)}
              height={Math.max(1.2, cell)}
              fill={probabilityColor(p)}
            />
          </g>
        ))}
      </g>

      {overlayPairs && (
        <g fill="none" stroke="#1a1a1a" strokeWidth={0.8}>
          {overlayPairs.map((partner, i) =>
            partner > i ? (
              <rect
                key={`o${i}`}
                x={x(partner)}
                y={y(i)}
                width={Math.max(1.6, cell)}
                height={Math.max(1.6, cell)}
              />
            ) : null,
          )}
        </g>
      )}

      {/* strand boundaries */}
      <g stroke="#0d3d5c" strokeWidth={0.9}>
        {boundaries.map((value) => (
          <g key={`s${value}`}>
            <line x1={x(value)} y1={marginTop} x2={x(value)} y2={marginTop + plot} />
            <line x1={marginLeft} y1={y(value)} x2={marginLeft + plot} y2={y(value)} />
          </g>
        ))}
      </g>

      {/* unpaired strip */}
      {unpaired && (
        <g>
          {Array.from({ length: n }, (_, i) => (
            <rect
              key={`u${i}`}
              x={marginLeft + plot + stripGap}
              y={y(i)}
              width={stripWidth}
              height={Math.max(1.2, cell)}
              fill={probabilityColor(unpaired[i])}
            >
              <title>{`${i + 1} unpaired p=${Number(unpaired[i]).toFixed(4)}`}</title>
            </rect>
          ))}
          <text
            x={marginLeft + plot + stripGap + stripWidth / 2}
            y={marginTop - 4}
            textAnchor="middle"
            fontSize={8}
            fill="#6d6d6d"
          >
            free
          </text>
        </g>
      )}

      {/* axes */}
      <g fontSize={9} fill="#2f2f2f">
        {ticks.map((value) => (
          <text key={`tx${value}`} x={x(value)} y={marginTop + plot + 12} textAnchor="middle">
            {value}
          </text>
        ))}
        {ticks.map((value) => (
          <text key={`ty${value}`} x={marginLeft - 6} y={y(value) + 3} textAnchor="end">
            {value}
          </text>
        ))}
      </g>
      <text
        x={marginLeft + plot / 2}
        y={marginTop + plot + 26}
        textAnchor="middle"
        fontSize={11}
        fill="#2f2f2f"
      >
        Base index
      </text>
      <text
        transform={`translate(14, ${marginTop + plot / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={11}
        fill="#2f2f2f"
      >
        Base index
      </text>

      {strandNames && strandLengths && strandLengths.length > 1 && (
        <g fontSize={9} fill="#6d6d6d">
          {strandLengths.map((length, index) => {
            const start = strandLengths.slice(0, index).reduce((a, b) => a + b, 0);
            return (
              <text
                key={`sn${index}`}
                x={x(start + length / 2)}
                y={marginTop - 4}
                textAnchor="middle"
              >
                {strandNames[index]}
              </text>
            );
          })}
        </g>
      )}

      {caption && (
        <text
          x={marginLeft + plot / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize={11}
          fill="#2f2f2f"
        >
          {caption}
        </text>
      )}

      <ColorBar x={marginLeft + plot + stripGap + stripWidth + 18} top={marginTop} height={plot} />
    </svg>
  );
}
