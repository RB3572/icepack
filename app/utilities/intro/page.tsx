import Link from "next/link";

export const metadata = { title: "Utilities intro | Newerpack" };

export default function UtilitiesIntroPage() {
  return (
    <main className="panel prose">
      <h1>Utilities page</h1>
      <p>
        The Utilities page analyses, designs or annotates a single complex ensemble.
        It accepts sequence information, structure information, or both, and does
        whatever the available information allows:
      </p>
      <ul>
        <li>
          Evaluates a specified secondary structure in the context of the complex it
          belongs to: structure free energy, equilibrium probability, ensemble defect
          and normalized ensemble defect.
        </li>
        <li>
          Lays out, renders and annotates structures given in dot-parens-plus, RLE
          dot-parens-plus or DU+ notation.
        </li>
        <li>
          Designs a sequence for a specified structure, or finds the MFE structure of
          a specified sequence.
        </li>
      </ul>

      <h2>Notations</h2>
      <p>
        <strong>dot-parens-plus</strong> gives one character per nucleotide:
        <code> . </code> for unpaired, matching <code>( )</code> for a pair, and
        <code> + </code> for a strand break - for example
        <code> ..((((+))))..</code>.
      </p>
      <p>
        <strong>RLE dot-parens-plus</strong> follows each symbol with a repeat count:
        <code> .2(4+)4.2</code> expands to the same structure.
      </p>
      <p>
        <strong>DU+</strong> describes duplexes and unpaired runs:
        <code> D4(U6)</code> is a four base-pair stem closing a six nucleotide loop.
      </p>

      <h2>Quantities</h2>
      <p>
        The complex free energy is <code>ΔG(φ) = -kT log Q(φ)</code> over the whole
        ensemble; the structure free energy <code>ΔG(φ,s)</code> is the loop-sum for
        the one structure drawn; and the structure&apos;s equilibrium probability is
        <code> p(φ,s) = exp(-(ΔG(φ,s) - ΔG(φ))/kT)</code>. The ensemble defect
        <code> n(φ,s) = N - Σ P(φ)∘S(s)</code> counts, on average, how many
        nucleotides are in a different pairing state from the one the target
        structure asks for.
      </p>

      <p>
        Try out the <Link href="/utilities/demos">demos</Link>.
      </p>
    </main>
  );
}
