export const metadata = { title: "Definitions | Icepack" };

const ENTRIES: Array<[string, React.ReactNode]> = [
  [
    "Secondary structure",
    "A set of base pairs on one or more strands in which no two pairs cross. Each base pairs with at most one other, and a hairpin loop encloses at least three unpaired nucleotides.",
  ],
  [
    "Complex",
    "A multiset of strand species together with the ensemble of connected secondary structures they can form. A complex of L strands has L-1 nicks, and the polymer graph must join every strand.",
  ],
  [
    "Ordered complex",
    "One circular ordering of the strands in a complex. Distinct orderings are summed over, each divided by its rotational symmetry, which is the usual symmetry correction.",
  ],
  [
    "Partition function",
    "Q(φ) = Σ exp(-ΔG(φ,s)/kT) over the ensemble. The complex free energy is ΔG(φ) = -kT log Q(φ).",
  ],
  [
    "MFE structure",
    "The structure with the lowest free energy in the ensemble. It may be degenerate, and it is not necessarily representative of the ensemble.",
  ],
  [
    "Pair probability",
    "P(i,j) is the equilibrium probability that nucleotides i and j are paired; P(i, unpaired) is the probability that i is unpaired. Rows of the matrix sum to one.",
  ],
  [
    "Test tube ensemble",
    "A set of strand species at specified total concentrations together with the set of complexes they may form. Equilibrium concentrations follow from minimising the free energy of the dilute solution subject to mass conservation.",
  ],
  [
    "Melt profile",
    "The fraction of nucleotides unpaired in a test tube ensemble as a function of temperature. Separate transitions typically correspond to complex dissociation and to unfolding within the resulting strands.",
  ],
  [
    "Ensemble defect",
    "n(φ,s) = N - Σ P(φ)∘S(s): the average number of nucleotides whose pairing state differs from the target structure. Dividing by N gives the normalized ensemble defect.",
  ],
  [
    "MFE defect",
    "μ(φ,s) = N - Σ S(s_MFE)∘S(s): the number of nucleotides paired differently in the MFE structure than in the target.",
  ],
  [
    "Structure probability",
    "p(φ,s) = exp(-(ΔG(φ,s) - ΔG(φ))/kT): the equilibrium fraction of the ensemble occupying one specified structure.",
  ],
  [
    "Ensemble size",
    "The number of unpseudoknotted secondary structures a sequence admits. It grows exponentially with length, which is why ensemble-level quantities, not single structures, are the useful currency.",
  ],
  [
    "Domain",
    "A contiguous run of nucleotides treated as one design unit. A trailing * marks the reverse complement of a domain.",
  ],
  [
    "On-target and off-target complexes",
    "In a design tube, on-targets are complexes that should form at a specified concentration; off-targets are the other complexes the same strands could form, each with a vanishing target concentration.",
  ],
];

export default function DefinitionsPage() {
  return (
    <main className="panel prose">
      <h1>Definitions</h1>
      <dl>
        {ENTRIES.map(([term, body]) => (
          <div key={term} style={{ marginBottom: 14 }}>
            <dt style={{ fontWeight: 700 }}>{term}</dt>
            <dd style={{ margin: "2px 0 0", maxWidth: "78ch" }}>{body}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
