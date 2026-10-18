import Link from "next/link";

export const metadata = { title: "Download | Icepack" };

export default function DownloadPage() {
  return (
    <main className="panel prose">
      <h1>Download</h1>
      <p>
        Icepack is a web application plus a self-contained TypeScript engine. The
        engine has no runtime dependencies and can be used on its own:
      </p>
      <pre
        style={{
          background: "var(--shade)",
          border: "1px solid var(--rule)",
          padding: 12,
          fontSize: 12,
          overflowX: "auto",
        }}
      >{`import { encodeSequence } from "@/lib/nupack/alphabet";
import { Model, makeNickedSequence } from "@/lib/nupack/model";
import { partitionFunction } from "@/lib/nupack/pf";
import { mfe } from "@/lib/nupack/mfe";

const model = new Model({ material: "dna", celsius: 23 });
const seq = makeNickedSequence([
  encodeSequence("CCACACCACAACAACCACATCTCG"),
  encodeSequence("CGAGATGTGGTTGTTGTGGTGTGGATACAACCACACCACAACAACCAC"),
]);

const pf = partitionFunction(seq, model, { pairs: true });
const best = mfe(seq, model);

console.log(pf.freeEnergy, best.energy);`}</pre>

      <h2>Modules</h2>
      <ul>
        <li>
          <code>lib/nupack/model.ts</code> — the energy model and the nicked-sequence
          representation
        </li>
        <li>
          <code>lib/nupack/pf.ts</code> — partition function and pair probabilities
        </li>
        <li>
          <code>lib/nupack/mfe.ts</code> — MFE structure and traceback
        </li>
        <li>
          <code>lib/nupack/energy.ts</code> — free energy of one specified structure
        </li>
        <li>
          <code>lib/nupack/complex.ts</code> — complexes, orderings and symmetry
        </li>
        <li>
          <code>lib/nupack/concentrations.ts</code> — equilibrium concentration solver
        </li>
        <li>
          <code>lib/nupack/analysis.ts</code> — test tube analysis and melts
        </li>
        <li>
          <code>lib/nupack/design.ts</code> — multi-tube sequence design
        </li>
        <li>
          <code>lib/nupack/ensemble.ts</code> — ensemble size
        </li>
        <li>
          <code>lib/nupack/structure.ts</code> — structure notations and conversions
        </li>
        <li>
          <code>lib/nupack/layout.ts</code> — secondary structure layout for drawing
        </li>
      </ul>

      <h2>Parameter files</h2>
      <p>
        Nearest-neighbour parameters are built from the published Turner 2004 (RNA)
        and SantaLucia / Mathews 2004 (DNA) sets by{" "}
        <code>lib/nupack/params/build-params.mjs</code>, which converts a
        ViennaRNA-format <code>.par</code> file into the JSON the engine loads. Point
        it at a different parameter file to swap sets.
      </p>

      <p>
        See <Link href="/model">Model and parameters</Link> for what the engine does
        and does not model.
      </p>
    </main>
  );
}
