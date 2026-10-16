/** Perceptual-ish spectral ramp used for equilibrium probabilities. */
const STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [16, 12, 48]],
  [0.1, [26, 36, 134]],
  [0.2, [26, 86, 200]],
  [0.3, [33, 150, 226]],
  [0.4, [44, 206, 206]],
  [0.5, [74, 214, 126]],
  [0.6, [160, 220, 60]],
  [0.7, [240, 212, 44]],
  [0.8, [244, 150, 36]],
  [0.9, [226, 70, 32]],
  [1.0, [130, 12, 16]],
];

export function probabilityColor(value: number): string {
  const t = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  for (let i = 1; i < STOPS.length; i++) {
    const [stop, color] = STOPS[i];
    if (t <= stop) {
      const [prevStop, prevColor] = STOPS[i - 1];
      const f = (t - prevStop) / (stop - prevStop || 1);
      const mix = prevColor.map((channel, k) =>
        Math.round(channel + (color[k] - channel) * f),
      );
      return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
    }
  }
  return "rgb(130,12,16)";
}

/** Colours used when shading by nucleotide identity. */
export const IDENTITY_COLORS: Record<string, string> = {
  A: "#d64545",
  C: "#2f8f4e",
  G: "#2f6fb5",
  U: "#d08a1e",
  T: "#d08a1e",
  N: "#9a9a9a",
};

export function identityColor(letter: string): string {
  return IDENTITY_COLORS[letter.toUpperCase()] ?? IDENTITY_COLORS.N;
}
