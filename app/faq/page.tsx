import Link from "next/link";

export const metadata = { title: "FAQ | Icepack" };

const QA: Array<[string, React.ReactNode]> = [
  [
    "Do I need an account to run jobs?",
    "No. Every calculation runs in this application, so Analysis, Design and Utilities all work without signing in.",
  ],
  [
    "How long do jobs take?",
    "Utilities is interactive for complexes up to a few hundred nucleotides. A single-temperature tube analysis of three 54-nt strands with complexes up to three strands takes roughly half a second; a thirteen-point melt of the same tube takes under half a minute. Cost grows as the cube of the complex length and with the number of complexes, which grows quickly with the maximum complex size.",
  ],
  [
    "Why is the MFE structure not the whole story?",
    "The number of structures grows exponentially with length, so the single lowest-energy structure can hold only a small part of the equilibrium population. The ensemble defect and the pair probability matrix describe the ensemble; the MFE structure describes one member of it.",
  ],
  [
    "Why are there two transitions in a melt curve?",
    "Usually because two different processes melt at different temperatures: first the intermolecular base pairs holding a multi-strand complex together, then the intramolecular structure that each released strand still has. Checking the equilibrium concentrations and the MFE structures either side of each transition tells you which is which.",
  ],
  [
    "Why does my complex come out less stable than in the reference implementation?",
    <>
      Coaxial stacking is not modelled here. Single strands agree closely, but a
      complex with nicks adjacent to helices loses roughly 1-2 kcal/mol per nicked
      junction relative to a model with coaxial terms. See{" "}
      <Link href="/model">Model and parameters</Link>.
    </>,
  ],
  [
    "Can I use G·T pairs in DNA?",
    "The DNA nearest-neighbour model treats G·T as a mismatch rather than a canonical pair, so wobble pairs are off by default for DNA and on for RNA. The Model options panel lets you override that either way.",
  ],
  [
    "What do the include and exclude lists do?",
    "They add or remove specific complexes from a tube's ensemble beyond the maximum complex size. Write a strand order, for example \"i1 h1 h2 h1\" for a four-strand polymer, which lets you model a longer complex without raising the maximum size for everything else.",
  ],
  [
    "What notation does the structure box accept?",
    "dot-parens-plus, RLE dot-parens-plus and DU+ notation are all accepted and are normalised to dot-parens-plus on the way out.",
  ],
  [
    "Is design deterministic?",
    "Yes, for a fixed random seed, model and input. Changing the seed, the number of trials or the time budget changes the search trajectory.",
  ],
];

export default function FaqPage() {
  return (
    <main className="panel prose">
      <h1>Frequently asked questions</h1>
      {QA.map(([question, answer]) => (
        <section key={question}>
          <h2>{question}</h2>
          <p>{answer}</p>
        </section>
      ))}
    </main>
  );
}
