import Link from "next/link";

export const metadata = { title: "Design intro | Newerpack" };

export default function DesignIntroPage() {
  return (
    <main className="panel prose">
      <h1>Design page</h1>
      <p>
        The Design page engineers sequences for a multi-tube ensemble. Each target
        test tube contains a set of desired <em>on-target</em> complexes, each with a
        target secondary structure and a target concentration, together with the
        <em> off-target</em> complexes that the same strands could form, each with a
        vanishing target concentration.
      </p>

      <h2>Objective</h2>
      <p>
        Optimisation minimises the multi-tube ensemble defect. For each tube, the
        structural term sums the ensemble defect of every on-target complex weighted
        by how much of it actually forms, and the concentration term charges the
        full length of any on-target material lost to off-targets:
      </p>
      <p style={{ fontFamily: "Courier New, monospace", fontSize: 12 }}>
        C(h) = Σ<sub>j∈on</sub> min(x<sub>hj</sub>, x*<sub>hj</sub>)·n(φ, s<sub>j</sub>) +
        |s<sub>j</sub>|·max(0, x*<sub>hj</sub> − x<sub>hj</sub>)
      </p>
      <p>
        That combines a positive design paradigm - explicitly designing for the
        structures you want - with a negative design paradigm - explicitly designing
        against the complexes you do not. Minimising structure probability alone is
        not enough: a sequence can make a target structure the MFE structure while
        still leaving most of the ensemble in competing folds.
      </p>

      <h2>Design variables</h2>
      <p>
        Sequences are specified as domains. A strand is an ordered list of domains,
        and a trailing <code>*</code> marks a complemented domain. Every base pair in
        a target structure couples two design positions, so positions are merged into
        components whose members are either identical to, or complementary to, a
        representative. Mutating a component therefore keeps every target structure
        sequence-compatible by construction, and a contradiction between targets is
        reported rather than silently ignored.
      </p>
      <p>
        Hard sequence constraints are IUPAC codes on a domain (<code>N</code>,
        <code>R</code>, <code>S</code>, <code>W</code> and so on); a bare number such
        as <code>N12</code> or <code>12</code> means that many unconstrained
        nucleotides.
      </p>

      <h2>Search</h2>
      <p>
        Optimisation is a seeded mutation search: start from a random sequence that
        satisfies the constraints, propose single-component mutations, and accept
        any that does not increase the objective. It stops when the normalized defect
        falls below the stop condition, when the time budget runs out, or when a long
        run of mutations fails to improve. Running several trials and keeping the
        best result is usually worth more than a longer single run.
      </p>

      <p>
        Try out the <Link href="/design/demos">demos</Link>.
      </p>
    </main>
  );
}
