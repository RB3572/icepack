/**
 * Secondary structure layout.
 *
 * Every loop is drawn as a circle whose radius is chosen so that the chords
 * between consecutive bases have their natural lengths: one unit along the
 * backbone and the pair width across a helix. Stacked pairs short-circuit that
 * search and simply step along the helix axis, which keeps helices straight.
 * The exterior loop is laid out along a straight line (a circle of infinite
 * radius), as in the usual published renderings.
 */

export interface LayoutOptions {
  /** Distance between consecutive unpaired bases. */
  baseDistance?: number;
  /** Distance between the two bases of a pair. */
  pairDistance?: number;
  /** Rise between stacked pairs along a helix. */
  helixRise?: number;
}

export interface StructureLayout {
  x: Float64Array;
  y: Float64Array;
  n: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

const TWO_PI = Math.PI * 2;

function solveRadius(chords: number[]): number {
  const longest = Math.max(...chords);
  let low = longest / 2 + 1e-9;
  let high = longest / 2;
  // Grow until the circle is big enough that the chords no longer wrap past 2pi.
  for (let i = 0; i < 200; i++) {
    high *= 2;
    if (sweep(chords, high) <= TWO_PI) break;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (sweep(chords, mid) > TWO_PI) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function sweep(chords: number[], radius: number): number {
  let total = 0;
  for (const chord of chords) {
    total += 2 * Math.asin(Math.min(1, chord / (2 * radius)));
  }
  return total;
}

function normalize(angle: number): number {
  let value = angle % TWO_PI;
  if (value < 0) value += TWO_PI;
  return value;
}

export function layoutStructure(
  pairs: ArrayLike<number>,
  options: LayoutOptions = {},
): StructureLayout {
  const n = pairs.length;
  const baseDistance = options.baseDistance ?? 1;
  const pairDistance = options.pairDistance ?? 1.2;
  const helixRise = options.helixRise ?? 1;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  if (n === 0) {
    return { x, y, n, bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
  }

  /** Direct branches and unpaired bases of the loop body [from, to]. */
  function children(from: number, to: number): Array<{ kind: "base" | "pair"; i: number; j: number }> {
    const out: Array<{ kind: "base" | "pair"; i: number; j: number }> = [];
    let k = from;
    while (k <= to) {
      const partner = pairs[k];
      if (partner > k && partner <= to) {
        out.push({ kind: "pair", i: k, j: partner });
        k = partner + 1;
      } else {
        out.push({ kind: "base", i: k, j: k });
        k += 1;
      }
    }
    return out;
  }

  /**
   * Lays out everything enclosed by the pair (p, q), whose own coordinates are
   * already set. `dir` points from the pair into the loop it closes.
   */
  function placeLoop(p: number, q: number, dir: { dx: number; dy: number }) {
    const body = children(p + 1, q - 1);

    // A plain stack: step along the helix axis and recurse.
    if (body.length === 1 && body[0].kind === "pair" && body[0].i === p + 1 && body[0].j === q - 1) {
      const child = body[0];
      x[child.i] = x[p] + dir.dx * helixRise;
      y[child.i] = y[p] + dir.dy * helixRise;
      x[child.j] = x[q] + dir.dx * helixRise;
      y[child.j] = y[q] + dir.dy * helixRise;
      placeLoop(child.i, child.j, dir);
      return;
    }

    // Items around the loop circle: p, the body, then q.
    const items: Array<{ kind: "base" | "pair"; i: number; j: number }> = [
      { kind: "base", i: p, j: p },
      ...body,
      { kind: "base", i: q, j: q },
    ];
    const chords: number[] = [];
    for (let t = 0; t < items.length; t++) {
      const current = items[t];
      if (current.kind === "pair") chords.push(pairDistance);
      if (t < items.length - 1) chords.push(baseDistance);
    }
    chords.push(pairDistance); // closing chord from q back to p

    const radius = solveRadius(chords);
    const closingAngle = 2 * Math.asin(Math.min(1, pairDistance / (2 * radius)));
    const height = Math.sqrt(Math.max(0, radius * radius - (pairDistance / 2) ** 2));
    const midX = (x[p] + x[q]) / 2;
    const midY = (y[p] + y[q]) / 2;
    const cx = midX + dir.dx * height;
    const cy = midY + dir.dy * height;

    const anglep = Math.atan2(y[p] - cy, x[p] - cx);
    const angleq = Math.atan2(y[q] - cy, x[q] - cx);
    const target = TWO_PI - closingAngle;
    const sign = Math.abs(normalize(angleq - anglep) - target) < 1e-6 ? 1 : -1;

    let angle = anglep;
    let chordIndex = 0;
    const pending: Array<{ i: number; j: number }> = [];

    for (let t = 0; t < items.length; t++) {
      const item = items[t];
      if (t > 0) {
        // step across the chord that leads into this item
        angle += sign * 2 * Math.asin(Math.min(1, chords[chordIndex] / (2 * radius)));
        chordIndex += 1;
        x[item.i] = cx + radius * Math.cos(angle);
        y[item.i] = cy + radius * Math.sin(angle);
      }
      if (item.kind === "pair") {
        angle += sign * 2 * Math.asin(Math.min(1, chords[chordIndex] / (2 * radius)));
        chordIndex += 1;
        x[item.j] = cx + radius * Math.cos(angle);
        y[item.j] = cy + radius * Math.sin(angle);
        pending.push({ i: item.i, j: item.j });
      }
    }

    for (const branch of pending) {
      const bx = (x[branch.i] + x[branch.j]) / 2;
      const by = (y[branch.i] + y[branch.j]) / 2;
      let dx = bx - cx;
      let dy = by - cy;
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      placeLoop(branch.i, branch.j, { dx, dy });
    }
  }

  // Exterior loop: walk left to right, raising each branch upward.
  const top = children(0, n - 1);
  let cursor = 0;
  for (const item of top) {
    if (item.kind === "base") {
      x[item.i] = cursor;
      y[item.i] = 0;
      cursor += baseDistance;
      continue;
    }
    x[item.i] = cursor;
    y[item.i] = 0;
    x[item.j] = cursor + pairDistance;
    y[item.j] = 0;
    placeLoop(item.i, item.j, { dx: 0, dy: 1 });
    cursor += pairDistance + baseDistance;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, x[i]);
    maxX = Math.max(maxX, x[i]);
    minY = Math.min(minY, y[i]);
    maxY = Math.max(maxY, y[i]);
  }
  return { x, y, n, bounds: { minX, maxX, minY, maxY } };
}
