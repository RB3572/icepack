/** Renders sample structure diagrams straight from the engine, for eyeballing. */
import { writeFileSync } from "node:fs";
import { encodeSequence, decodeSequence } from "../lib/nupack/alphabet";
import { Model, makeNickedSequence } from "../lib/nupack/model";
import { mfe } from "../lib/nupack/mfe";
import { partitionFunction } from "../lib/nupack/pf";
import { layoutStructure } from "../lib/nupack/layout";
import { formatStructure } from "../lib/nupack/structure";

const STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [16, 12, 48]], [0.1, [26, 36, 134]], [0.2, [26, 86, 200]], [0.3, [33, 150, 226]],
  [0.4, [44, 206, 206]], [0.5, [74, 214, 126]], [0.6, [160, 220, 60]], [0.7, [240, 212, 44]],
  [0.8, [244, 150, 36]], [0.9, [226, 70, 32]], [1.0, [130, 12, 16]],
];
function color(v: number) {
  const t = Math.min(1, Math.max(0, v));
  for (let i = 1; i < STOPS.length; i++) {
    const [s, c] = STOPS[i];
    if (t <= s) {
      const [ps, pc] = STOPS[i - 1];
      const f = (t - ps) / (s - ps || 1);
      const m = pc.map((ch, k) => Math.round(ch + (c[k] - ch) * f));
      return `rgb(${m[0]},${m[1]},${m[2]})`;
    }
  }
  return "rgb(130,12,16)";
}

function render(title: string, strands: string[], model: Model, W = 520, H = 420) {
  const encoded = strands.map(encodeSequence);
  const seq = makeNickedSequence(encoded);
  const lens = encoded.map((s) => s.length);
  const best = mfe(seq, model);
  const pf = partitionFunction(seq, model, { pairs: true });
  const n = seq.n;
  const letters = encoded.map((s) => decodeSequence(s, model.material)).join("");
  const prob = Array.from({ length: n }, (_, i) => {
    const p = best.pairs[i];
    return p < 0 ? pf.unpaired![i] : pf.pairProbabilities![i * n + p];
  });

  const L = layoutStructure(Array.from(best.pairs));
  const pad = 30, top = 26, bot = 26;
  const sx = Math.max(1e-6, L.bounds.maxX - L.bounds.minX);
  const sy = Math.max(1e-6, L.bounds.maxY - L.bounds.minY);
  const s = Math.min((W - 2 * pad - 60) / sx, (H - 2 * pad - top - bot) / sy);
  const ox = pad + ((W - 2 * pad - 60) - sx * s) / 2 - L.bounds.minX * s;
  const oy = pad + top + ((H - 2 * pad - top - bot) - sy * s) / 2 + L.bounds.maxY * s;
  const r = Math.max(1.8, Math.min(5.5, s * 0.22));
  const px = (i: number) => (ox + L.x[i] * s).toFixed(2);
  const py = (i: number) => (oy - L.y[i] * s).toFixed(2);

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">`);
  parts.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
  parts.push(`<text x="${(W - 60) / 2}" y="18" text-anchor="middle" font-size="13">${title}</text>`);
  parts.push(`<g stroke="#2f2f2f" stroke-width="1">`);
  for (let i = 0; i < n; i++) if (best.pairs[i] > i) parts.push(`<line x1="${px(i)}" y1="${py(i)}" x2="${px(best.pairs[i])}" y2="${py(best.pairs[i])}"/>`);
  parts.push(`</g><g fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round">`);
  let off = 0;
  for (const len of lens) {
    const pts: string[] = [];
    for (let k = 0; k < len; k++) pts.push(`${px(off + k)},${py(off + k)}`);
    parts.push(`<polyline points="${pts.join(" ")}"/>`);
    off += len;
  }
  parts.push(`</g><g>`);
  for (let i = 0; i < n; i++) parts.push(`<circle cx="${px(i)}" cy="${py(i)}" r="${r.toFixed(2)}" fill="${color(prob[i])}"/>`);
  parts.push(`</g>`);
  // colour bar
  const bx = W - 52, bt = 40, bh = H - 100;
  for (let i = 0; i < 40; i++) parts.push(`<rect x="${bx}" y="${(bt + (i * bh) / 40).toFixed(2)}" width="11" height="${(bh / 40 + 0.6).toFixed(2)}" fill="${color(1 - i / 39)}"/>`);
  for (const v of [0, 0.5, 1]) parts.push(`<text x="${bx + 14}" y="${(bt + (1 - v) * bh + 3).toFixed(2)}" font-size="9">${v.toFixed(1)}</text>`);
  parts.push(`<text x="${(W - 60) / 2}" y="${H - 8}" text-anchor="middle" font-size="12">MFE ${best.energy.toFixed(2)} kcal/mol · complex ${pf.freeEnergy.toFixed(2)} kcal/mol</text>`);
  parts.push(`</svg>`);
  console.log(`${title}: ${formatStructure(best.pairs, lens)}`);
  return parts.join("\n");
}

const dna23 = new Model({ material: "dna", celsius: 23 });
const rna37 = new Model({ material: "rna", celsius: 37 });

const svgs = [
  render("HCR hairpin h1 (DNA, 23 °C)", ["CGAGATGTGGTTGTTGTGGTGTGGATACAACCACACCACAACAACCAC"], dna23),
  render("Initiator + hairpin (DNA, 23 °C)", ["CCACACCACAACAACCACATCTCG", "CGAGATGTGGTTGTTGTGGTGTGGATACAACCACACCACAACAACCAC"], dna23),
  render("RNA stick figure (RNA, 37 °C)", ["AAGCGCCGGCUUCUGCGCCCGCCAAGCGGGCUCGCCCAACCCACGAGAUGGCAAUGCCAUCGCAGCUAUACCGCCGUAGGCGGUAUGCCGGCGCA"], rna37, 620, 520),
];

const html = `<svg xmlns="http://www.w3.org/2000/svg" width="1660" height="540">
<rect width="1660" height="540" fill="#fff"/>
<g transform="translate(0,20)">${svgs[0]}</g>
<g transform="translate(520,20)">${svgs[1]}</g>
<g transform="translate(1040,0)">${svgs[2]}</g>
</svg>`;
writeFileSync("sample-structures.svg", html);
console.log("wrote sample-structures.svg");
