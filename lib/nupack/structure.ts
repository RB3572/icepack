/**
 * Secondary structure notations and conversions.
 *
 * Supported input notations:
 *   dot-parens-plus      ..((((+))))..        "+" marks a strand break
 *   RLE dot-parens-plus  .2(4+)4.2            counts follow the symbol
 *   DU+                  U2 D4( U2 )          duplex / unpaired run notation
 */

export interface ParsedStructure {
  /** pairs[i] is the partner of base i, or -1 when unpaired. */
  pairs: Int32Array;
  /** Lengths of the individual strands, in order. */
  strandLengths: number[];
  n: number;
}

export class StructureError extends Error {}

const OPEN = "([{<";
const CLOSE = ")]}>";

/** Expands run-length encoded dot-parens-plus into the plain form. */
export function expandRle(text: string): string {
  let out = "";
  let index = 0;
  const compact = text.replace(/\s+/g, "");
  while (index < compact.length) {
    const symbol = compact[index];
    index += 1;
    let digits = "";
    while (index < compact.length && /\d/.test(compact[index])) {
      digits += compact[index];
      index += 1;
    }
    const count = digits === "" ? 1 : Number(digits);
    if (symbol === "+") {
      out += "+";
      continue;
    }
    out += symbol.repeat(count);
  }
  return out;
}

/**
 * Expands DU+ notation. `D<n>(...)` is a duplex of n pairs wrapping the body,
 * `U<n>` is a run of n unpaired bases, `+` is a strand break.
 */
export function expandDuPlus(text: string): string {
  const compact = text.replace(/\s+/g, "");
  let index = 0;

  function body(): string {
    let out = "";
    while (index < compact.length) {
      const symbol = compact[index];
      if (symbol === ")") break;
      if (symbol === "+") {
        out += "+";
        index += 1;
        continue;
      }
      if (symbol === "U" || symbol === "D") {
        index += 1;
        let digits = "";
        while (index < compact.length && /\d/.test(compact[index])) {
          digits += compact[index];
          index += 1;
        }
        const count = digits === "" ? 1 : Number(digits);
        if (symbol === "U") {
          out += ".".repeat(count);
          continue;
        }
        if (compact[index] !== "(") {
          throw new StructureError("DU+ notation: expected '(' after a duplex length");
        }
        index += 1;
        const inner = body();
        if (compact[index] !== ")") {
          throw new StructureError("DU+ notation: unbalanced parentheses");
        }
        index += 1;
        out += "(".repeat(count) + inner + ")".repeat(count);
        continue;
      }
      throw new StructureError(`DU+ notation: unexpected character "${symbol}"`);
    }
    return out;
  }

  const result = body();
  if (index !== compact.length) {
    throw new StructureError("DU+ notation: unbalanced parentheses");
  }
  return result;
}

/** Accepts any supported notation and returns plain dot-parens-plus. */
export function normalizeStructure(text: string): string {
  const compact = text.replace(/\s+/g, "");
  if (compact === "") return "";
  if (/[DU]/.test(compact)) return expandDuPlus(compact);
  if (/\d/.test(compact)) return expandRle(compact);
  return compact;
}

export function parseStructure(text: string): ParsedStructure {
  const plain = normalizeStructure(text);
  const pairs: number[] = [];
  const stacks: number[][] = OPEN.split("").map(() => []);
  const strandLengths: number[] = [];
  let current = 0;

  for (const symbol of plain) {
    if (symbol === "+") {
      strandLengths.push(current);
      current = 0;
      continue;
    }
    const index = pairs.length;
    if (symbol === "." || symbol === "-") {
      pairs.push(-1);
    } else {
      const openIndex = OPEN.indexOf(symbol);
      const closeIndex = CLOSE.indexOf(symbol);
      if (openIndex >= 0) {
        stacks[openIndex].push(index);
        pairs.push(-1);
      } else if (closeIndex >= 0) {
        const stack = stacks[closeIndex];
        const partner = stack.pop();
        if (partner === undefined) {
          throw new StructureError(`Unbalanced "${symbol}" in the structure`);
        }
        pairs.push(partner);
        pairs[partner] = index;
      } else {
        throw new StructureError(`Unexpected character "${symbol}" in the structure`);
      }
    }
    current += 1;
  }
  strandLengths.push(current);

  for (const stack of stacks) {
    if (stack.length > 0) throw new StructureError("Unbalanced parentheses in the structure");
  }

  return { pairs: Int32Array.from(pairs), strandLengths, n: pairs.length };
}

/** Renders a pair table back to dot-parens-plus with the given strand split. */
export function formatStructure(
  pairs: ArrayLike<number>,
  strandLengths?: number[],
): string {
  const n = pairs.length;
  let out = "";
  const breaks = new Set<number>();
  if (strandLengths) {
    let running = 0;
    for (let i = 0; i < strandLengths.length - 1; i++) {
      running += strandLengths[i];
      breaks.add(running);
    }
  }
  for (let i = 0; i < n; i++) {
    if (breaks.has(i)) out += "+";
    const partner = pairs[i];
    out += partner < 0 ? "." : partner > i ? "(" : ")";
  }
  return out;
}

/** Run-length encodes plain dot-parens-plus. */
export function toRle(structure: string): string {
  let out = "";
  let index = 0;
  while (index < structure.length) {
    const symbol = structure[index];
    if (symbol === "+") {
      out += "+";
      index += 1;
      continue;
    }
    let run = 0;
    while (index + run < structure.length && structure[index + run] === symbol) run += 1;
    out += run > 1 ? `${symbol}${run}` : symbol;
    index += run;
  }
  return out;
}

/**
 * The structure matrix S used by the defect definitions: S[i][j] = 1 when i
 * pairs j, and S[i][n] = 1 when i is unpaired. Returned row-major with n+1
 * columns.
 */
export function structureMatrix(pairs: ArrayLike<number>): Float64Array {
  const n = pairs.length;
  const matrix = new Float64Array(n * (n + 1));
  for (let i = 0; i < n; i++) {
    const partner = pairs[i];
    if (partner < 0) matrix[i * (n + 1) + n] = 1;
    else matrix[i * (n + 1) + partner] = 1;
  }
  return matrix;
}

/** Lists the (i, j) pairs with i < j. */
export function pairList(pairs: ArrayLike<number>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pairs.length; i++) {
    const partner = pairs[i];
    if (partner > i) out.push([i, partner]);
  }
  return out;
}

/** Strand index of every base, derived from strand lengths. */
export function strandIndices(strandLengths: number[]): Int32Array {
  const n = strandLengths.reduce((a, b) => a + b, 0);
  const out = new Int32Array(n);
  let index = 0;
  strandLengths.forEach((length, strand) => {
    for (let k = 0; k < length; k++) out[index++] = strand;
  });
  return out;
}

/** True when base pairs join every strand into a single complex. */
export function isConnected(
  pairs: ArrayLike<number>,
  strandLengths: number[],
): boolean {
  const count = strandLengths.length;
  if (count <= 1) return true;
  const strandOf = strandIndices(strandLengths);
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let i = 0; i < pairs.length; i++) {
    const partner = pairs[i];
    if (partner > i) {
      const a = find(strandOf[i]);
      const b = find(strandOf[partner]);
      if (a !== b) parent[a] = b;
    }
  }
  const root = find(0);
  for (let s = 1; s < count; s++) if (find(s) !== root) return false;
  return true;
}
