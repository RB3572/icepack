export const metadata = { title: "Model | Newerpack" };

export default function ModelPage() {
  return (
    <main className="panel prose">
      <h1>Model and parameters</h1>

      <h2>Ensemble</h2>
      <p>
        A complex is an ordered set of strands, written as one concatenated
        sequence carrying a nick wherever one strand ends and the next begins. The
        ensemble is every unpseudoknotted secondary structure on that sequence
        whose polymer graph is connected, and each structure is scored by summing
        the free energies of its loops.
      </p>
      <p>
        A loop whose unpaired regions span a nick is not a real loop: it is part of
        the exterior loop, and is scored as such. Connectivity has a clean
        characterisation under that rule - the exterior loop must contain no nick,
        and every other loop at most one, because two nicks in one loop cut its
        boundary cycle into two arcs that no unpseudoknotted base pair can join.
        The recursions enforce that directly, so the partition function covers
        connected structures only and no inclusion-exclusion over sub-complexes is
        needed.
      </p>

      <h2>Free energies</h2>
      <p>
        Loop energies use the published nearest-neighbour parameter sets: Turner
        and Mathews 2004 for RNA and SantaLucia and Mathews 2004 for DNA, including
        stacking, hairpin, bulge and internal loop initiation, the 1×1, 2×1 and 2×2
        internal loop tables, terminal mismatches, dangling ends, special tri-,
        tetra- and hexaloops, the Ninio asymmetry term, the terminal AU/GU penalty,
        the linear multiloop model and the strand-association penalty.
      </p>
      <p>
        Temperature dependence comes from the paired enthalpy tables by
        <code> ΔG(T) = ΔH − (ΔH − ΔG<sub>37</sub>) · T / 310.15</code>. A DNA salt
        correction of <code>−0.114 · (T/310.15) · ln([Na⁺] + 3.3·√[Mg²⁺])</code> per
        base pair is applied; it vanishes at the 1 M Na⁺ reference condition the
        tables were fitted at.
      </p>

      <h2>Algorithms</h2>
      <ul>
        <li>
          <strong>Partition function</strong> — O(N³) inside recursions over Q
          (exterior), Q<sup>b</sup> (paired), Q<sup>m</sup> and Q<sup>m1</sup>
          (multiloop), with interior loops capped at 30 unpaired nucleotides, and a
          per-nucleotide scaling factor that keeps the sums inside a double.
        </li>
        <li>
          <strong>Pair probabilities</strong> — the matching outside recursions, so
          P(i,j) = Q<sup>b</sup>(i,j)·Ô(i,j)/Q in one extra pass rather than N²
          constrained partition functions.
        </li>
        <li>
          <strong>MFE</strong> — the same recursions in min-plus, with traceback
          through the same cases.
        </li>
        <li>
          <strong>Concentrations</strong> — minimising the free energy of the
          dilute solution subject to mass conservation is convex; the unconstrained
          dual is solved by a damped Newton iteration with a Cholesky step, which
          keeps every concentration positive by construction.
        </li>
        <li>
          <strong>Ensemble size</strong> — the same recursion with every structure
          weighted 1.
        </li>
      </ul>

      <h2>Validation</h2>
      <p>
        The partition function, pair probabilities and MFE are checked against
        exhaustive enumeration of every connected unpseudoknotted structure for
        short single strands, duplexes and three-strand complexes: free energies
        and pair probabilities agree to floating-point precision. Ensemble sizes
        reproduce the published counts (2349 structures for
        <code> ATAGTTTTCTCGAAAACGAT</code>).
      </p>

      <h2>Known differences from the reference implementation</h2>
      <p>
        This is an independent implementation, and two differences are worth
        knowing about when comparing numbers:
      </p>
      <ul>
        <li>
          <strong>Coaxial stacking is not modelled.</strong> The ensemble options
          that mention coaxial stacking fall back to terminal-mismatch and
          dangle treatment. Single strands therefore agree closely - structure free
          energies typically within a few tenths of a kcal/mol - while complexes
          with nicks adjacent to helices come out less stable than a model with
          coaxial terms, by roughly 1-2 kcal/mol per nicked helix junction.
        </li>
        <li>
          <strong>Mixed-material jobs are not supported.</strong> RNA/DNA and
          RNA/2&apos;OMe-RNA hybrids need hybrid nearest-neighbour tables that are
          not part of the published single-material sets; 2&apos;OMe-RNA is
          evaluated with the RNA set.
        </li>
      </ul>
      <p>
        Both are limitations of the parameterisation and the loop decomposition,
        not of the algorithms: the recursions, the connectivity handling, the
        outside algorithm and the concentration solver are exact for the model as
        stated.
      </p>
    </main>
  );
}
