import Link from "next/link";

export default function HomePage() {
  return (
    <main className="panel">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 36 }}>
        <div>
          <p style={{ marginTop: 0 }}>
            <strong style={{ color: "var(--brand-dark)" }}>Icepack</strong> is a
            software suite for the analysis and design of nucleic acid structures,
            devices and systems, for molecular programming, nucleic acid
            nanotechnology, synthetic biology and the life sciences more broadly.
          </p>
          <p>
            It implements the standard unpseudoknotted secondary structure model
            end to end: partition functions over complexes of interacting strands,
            minimum free energy structures, equilibrium base-pairing probabilities,
            equilibrium concentrations in a test tube, melt profiles, and sequence
            design against a multi-tube ensemble objective.
          </p>

          <div className="section-title">Interacting strands</div>
          <p>
            Complexes of arbitrarily many interacting strand species are treated
            directly, which is what makes it possible to capture the concentration
            effects that govern intermolecular interactions: how much of a complex
            forms, and how it is base-paired when it does.
          </p>

          <div className="section-title">Where to start</div>
          <ul style={{ margin: "0 0 12px 18px", padding: 0 }}>
            <li>
              <Link href="/utilities">Utilities</Link> — evaluate or draw one
              complex: structure free energy, equilibrium probability, ensemble
              defect, pair probability matrix.
            </li>
            <li>
              <Link href="/analysis/input">Analysis</Link> — a test tube of
              interacting strands: complex concentrations, structures and melts.
            </li>
            <li>
              <Link href="/design/input">Design</Link> — sequence design over a
              multi-tube ensemble with hard sequence constraints.
            </li>
          </ul>
          <p className="note">
            Every page ships with <Link href="/analysis/demos">demos</Link> you can
            run without any setup.
          </p>
        </div>

        <aside>
          <div
            style={{
              background: "var(--brand)",
              color: "#fff",
              textAlign: "center",
              padding: "8px 0",
              fontSize: 14,
            }}
          >
            Notes
          </div>
          <div style={{ border: "1px solid var(--brand-tint)", padding: "12px 14px", background: "#f2f9fd" }}>
            <p style={{ textAlign: "center", color: "var(--brand-dark)", margin: "0 0 10px" }}>
              What this build computes
            </p>
            <ul style={{ margin: "0 0 0 16px", padding: 0 }}>
              <li>Complex partition function and free energy</li>
              <li>MFE structure for a complex of any number of strands</li>
              <li>Equilibrium base-pairing probability matrix</li>
              <li>Equilibrium concentrations for a test tube ensemble</li>
              <li>Melt profiles across a temperature range</li>
              <li>Ensemble size, ensemble defect and MFE defect</li>
              <li>Sequence design against a multi-tube ensemble defect</li>
            </ul>
          </div>
          <p style={{ marginTop: 14 }}>
            <Link href="/model">Model and parameters</Link> describes the energy
            model, where the parameters come from, and the specific places where
            this implementation differs from the reference implementation it
            follows.
          </p>
        </aside>
      </div>
    </main>
  );
}
