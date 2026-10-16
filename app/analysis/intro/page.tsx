import Link from "next/link";

export const metadata = { title: "Analysis intro | Newerpack" };

export default function AnalysisIntroPage() {
  return (
    <main className="panel prose">
      <h1>Analysis page</h1>
      <p>
        The Analysis page computes the equilibrium concentration and base-pairing
        properties of a multi-tube ensemble containing one or more test tubes. Each
        test tube holds a user-specified set of strand species, each introduced at a
        user-specified concentration, and the complexes those strands can form.
      </p>

      <h2>What gets computed</h2>
      <p>
        For each complex in a tube the partition function of the ordered-complex
        ensemble is evaluated, giving the complex free energy
        <code> ΔG = -kT log Q</code>. Equilibrium concentrations then follow from
        minimising the free energy of the dilute solution subject to mass
        conservation, which is a convex problem solved exactly. For complexes that
        reach an appreciable concentration the MFE structure and the matrix of
        equilibrium base-pairing probabilities are also reported.
      </p>

      <h2>Why a test tube, not a single complex</h2>
      <p>
        A complex ensemble is subsidiary to a test tube ensemble, so complex
        analysis is inherent in test tube analysis but not the other way round. It
        is rarely possible to study one complex in isolation experimentally, so it
        is more physically meaningful to analyse strands in a tube that also
        contains the competing complexes that may form. If strands A and B are
        intended to form A·B, analysing only A·B presupposes the answer; analysing
        a tube containing A, B, A·A, A·B and B·B captures both how much A·B forms
        and how it is structured when it does.
      </p>

      <h2>Melts</h2>
      <p>
        Checking <em>Melt</em> repeats the whole calculation across a temperature
        range. The melt profile plots the fraction of nucleotides that are unpaired
        in the tube ensemble, which combines dissociation of complexes with the
        unfolding of structure within each complex - two processes that often show
        up as two separate transitions.
      </p>

      <p>
        Try out the <Link href="/analysis/demos">demos</Link>.
      </p>
    </main>
  );
}
