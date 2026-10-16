"use client";

import { useMemo } from "react";
import { layoutStructure } from "@/lib/nupack/layout";
import { identityColor, probabilityColor } from "./colormap";

export type BaseStyle = "circle" | "ticks";
export type BaseShading = "probability" | "identity" | "none";

export interface StructureDiagramProps {
  /** Bases without strand separators. */
  sequence: string;
  pairs: number[];
  strandLengths: number[];
  /** Probability that each base is in the state the drawn structure gives it. */
  probabilities?: number[];
  baseStyle?: BaseStyle;
  shading?: BaseShading;
  showBaseNumbers?: boolean;
  showBaseLetters?: boolean;
  topText?: string;
  bottomText?: string;
  width?: number;
  height?: number;
  /** Highlights one base, used by the Utilities cursor readout. */
  cursor?: number | null;
  onHoverBase?: (index: number | null) => void;
  svgRef?: React.Ref<SVGSVGElement>;
}

const COLORBAR_WIDTH = 54;

export function StructureDiagram({
  sequence,
  pairs,
  strandLengths,
  probabilities,
  baseStyle = "circle",
  shading = "probability",
  showBaseNumbers = false,
  showBaseLetters = false,
  topText,
  bottomText,
  width = 560,
  height = 460,
  cursor = null,
  onHoverBase,
  svgRef,
}: StructureDiagramProps) {
  const n = sequence.length;
  const layout = useMemo(
    () => layoutStructure(pairs.length === n ? pairs : new Array(n).fill(-1)),
    [pairs, n],
  );

  const showBar = shading === "probability" && probabilities !== undefined;
  const plotWidth = width - (showBar ? COLORBAR_WIDTH : 0);
  const padding = 26;
  const topRoom = topText ? 22 : 6;
  const bottomRoom = bottomText ? 24 : 6;

  const { scale, offsetX, offsetY, radius } = useMemo(() => {
    const spanX = Math.max(1e-6, layout.bounds.maxX - layout.bounds.minX);
    const spanY = Math.max(1e-6, layout.bounds.maxY - layout.bounds.minY);
    const usableW = plotWidth - padding * 2;
    const usableH = height - padding * 2 - topRoom - bottomRoom;
    const s = Math.min(usableW / spanX, usableH / spanY);
    const drawnW = spanX * s;
    const drawnH = spanY * s;
    return {
      scale: s,
      offsetX: padding + (usableW - drawnW) / 2 - layout.bounds.minX * s,
      offsetY: padding + topRoom + (usableH - drawnH) / 2 + layout.bounds.maxY * s,
      radius: Math.max(1.6, Math.min(5.5, s * 0.22)),
    };
  }, [layout, plotWidth, height, topRoom, bottomRoom]);

  if (n === 0) {
    return (
      <svg ref={svgRef} width={width} height={height} role="img" aria-label="No structure">
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={13} fill="#6d6d6d">
          No possible structure
        </text>
      </svg>
    );
  }

  // y is flipped so the structure grows upward on screen
  const px = (i: number) => offsetX + layout.x[i] * scale;
  const py = (i: number) => offsetY - layout.y[i] * scale;

  const strandStart: number[] = [];
  let running = 0;
  for (const length of strandLengths) {
    strandStart.push(running);
    running += length;
  }

  const colorOf = (i: number): string => {
    if (shading === "identity") return identityColor(sequence[i]);
    if (shading === "probability" && probabilities) {
      return probabilityColor(probabilities[i] ?? 0);
    }
    return "#f29f2e";
  };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      role="img"
      aria-label="Secondary structure diagram"
      onMouseLeave={() => onHoverBase?.(null)}
    >
      {topText && (
        <text x={plotWidth / 2} y={18} textAnchor="middle" fontSize={13} fill="#2f2f2f">
          {topText}
        </text>
      )}

      {/* base pairs */}
      <g stroke="#2f2f2f" strokeWidth={1}>
        {pairs.map((partner, i) =>
          partner > i ? (
            <line key={`p${i}`} x1={px(i)} y1={py(i)} x2={px(partner)} y2={py(partner)} />
          ) : null,
        )}
      </g>

      {/* backbone, one polyline per strand */}
      <g fill="none" stroke="#1a1a1a" strokeWidth={2} strokeLinecap="round">
        {strandLengths.map((length, strand) => {
          const start = strandStart[strand];
          const points: string[] = [];
          for (let k = 0; k < length; k++) {
            const i = start + k;
            points.push(`${px(i).toFixed(2)},${py(i).toFixed(2)}`);
          }
          return <polyline key={`b${strand}`} points={points.join(" ")} />;
        })}
      </g>

      {/* 3' arrow for each strand */}
      <g fill="#1a1a1a">
        {strandLengths.map((length, strand) => {
          if (length < 2) return null;
          const end = strandStart[strand] + length - 1;
          const prev = end - 1;
          const dx = px(end) - px(prev);
          const dy = py(end) - py(prev);
          const norm = Math.hypot(dx, dy) || 1;
          const ux = dx / norm;
          const uy = dy / norm;
          const tipX = px(end) + ux * radius * 2.2;
          const tipY = py(end) + uy * radius * 2.2;
          const size = radius * 2;
          return (
            <polygon
              key={`a${strand}`}
              points={[
                `${tipX},${tipY}`,
                `${tipX - ux * size + uy * size * 0.5},${tipY - uy * size - ux * size * 0.5}`,
                `${tipX - ux * size - uy * size * 0.5},${tipY - uy * size + ux * size * 0.5}`,
              ].join(" ")}
            />
          );
        })}
      </g>

      {/* bases */}
      <g>
        {Array.from({ length: n }, (_, i) =>
          baseStyle === "circle" ? (
            <circle
              key={`c${i}`}
              cx={px(i)}
              cy={py(i)}
              r={cursor === i ? radius * 1.8 : radius}
              fill={colorOf(i)}
              stroke={cursor === i ? "#1a1a1a" : "none"}
              strokeWidth={1}
              onMouseEnter={() => onHoverBase?.(i)}
            >
              <title>{`${i + 1} ${sequence[i]}${
                probabilities ? ` p=${(probabilities[i] ?? 0).toFixed(3)}` : ""
              }`}</title>
            </circle>
          ) : (
            <line
              key={`t${i}`}
              x1={px(i)}
              y1={py(i) - radius}
              x2={px(i)}
              y2={py(i) + radius}
              stroke={colorOf(i)}
              strokeWidth={2.4}
              onMouseEnter={() => onHoverBase?.(i)}
            >
              <title>{`${i + 1} ${sequence[i]}`}</title>
            </line>
          ),
        )}
      </g>

      {showBaseLetters && scale > 9 && (
        <g fontSize={Math.min(10, scale * 0.42)} fill="#ffffff" textAnchor="middle">
          {Array.from({ length: n }, (_, i) => (
            <text key={`l${i}`} x={px(i)} y={py(i) + radius * 0.6}>
              {sequence[i]}
            </text>
          ))}
        </g>
      )}

      {showBaseNumbers && (
        <g fontSize={9} fill="#6d6d6d" textAnchor="middle">
          {Array.from({ length: n }, (_, i) =>
            (i + 1) % 10 === 0 || i === 0 ? (
              <text key={`n${i}`} x={px(i)} y={py(i) - radius - 3}>
                {i + 1}
              </text>
            ) : null,
          )}
        </g>
      )}

      {bottomText && (
        <text
          x={plotWidth / 2}
          y={height - 8}
          textAnchor="middle"
          fontSize={12}
          fill="#2f2f2f"
        >
          {bottomText}
        </text>
      )}

      {showBar && <ColorBar x={plotWidth + 6} top={topRoom + 10} height={height - topRoom - bottomRoom - 30} />}
    </svg>
  );
}

export function ColorBar({
  x,
  top,
  height,
  label = "Equilibrium probability",
}: {
  x: number;
  top: number;
  height: number;
  label?: string;
}) {
  const steps = 40;
  const stepHeight = height / steps;
  return (
    <g>
      {Array.from({ length: steps }, (_, i) => {
        const value = 1 - i / (steps - 1);
        return (
          <rect
            key={i}
            x={x}
            y={top + i * stepHeight}
            width={12}
            height={stepHeight + 0.6}
            fill={probabilityColor(value)}
          />
        );
      })}
      <g fontSize={9} fill="#2f2f2f">
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((value) => (
          <text key={value} x={x + 15} y={top + (1 - value) * height + 3}>
            {value.toFixed(1)}
          </text>
        ))}
      </g>
      <text
        transform={`translate(${x + 44}, ${top + height / 2}) rotate(90)`}
        textAnchor="middle"
        fontSize={10}
        fill="#2f2f2f"
      >
        {label}
      </text>
    </g>
  );
}
