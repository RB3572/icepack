import Link from "next/link";

export const metadata = { title: "Utilities demos | Icepack" };

interface UtilityDemo {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  question: string;
  query: Record<string, string>;
}

const DEMOS: UtilityDemo[] = [
  {
    id: "two-state",
    title: "Demo 1",
    summary:
      "Evaluate a sequence designed to adopt two different target structures with roughly equal probability.",
    bullets: [
      "Material: RNA, 23 ºC",
      "Structure 1: a 10-bp stem with a 10-nt loop, 10 nt of tail",
      "Switch the structure box to the second target to compare",
    ],
    question:
      "Do the two structures really split the ensemble evenly, and how much probability is left for everything else?",
    query: {
      material: "rna",
      celsius: "23",
      sequence: "GCCGGUGCUGUUAUAUGCCUCAGCACCGGCAUAUAACAGC",
      structure: "((((((((((..........))))))))))..........",
    },
  },
  {
    id: "hcr-hairpin",
    title: "Demo 2",
    summary:
      "Inspect a metastable hybridization chain reaction hairpin: a 6-nt toehold, an 18-bp stem and a 6-nt loop.",
    bullets: ["Material: DNA, 23 ºC", "One strand, 48 nt", "Leave the structure box empty to get the MFE structure"],
    question:
      "Does the hairpin fold as intended, and how much of the ensemble sits in the intended structure?",
    query: {
      material: "dna",
      celsius: "23",
      sequence: "CGAGATGTGGTTGTTGTGGTGTGGATACAACCACACCACAACAACCAC",
      structure: "",
    },
  },
  {
    id: "duplex",
    title: "Demo 3",
    summary:
      "Evaluate a two-strand complex: the HCR initiator bound to its hairpin, with the propagation domain left exposed.",
    bullets: ["Material: DNA, 23 ºC", "Two strands separated by +", "Switch to the pair probability view to see the exposed domain"],
    question:
      "Is the domain that has to bind the next hairpin actually free in the intermediate?",
    query: {
      material: "dna",
      celsius: "23",
      sequence: "CCACACCACAACAACCACATCTCG+CGAGATGTGGTTGTTGTGGTGTGGATACAACCACACCACAACAACCAC",
      structure: "",
    },
  },
];

export default function UtilitiesDemosPage() {
  return (
    <main className="panel">
      {DEMOS.map((demo) => (
        <div className="demo-row" key={demo.id}>
          <div>
            <Link
              className="pill"
              href={`/utilities?${new URLSearchParams(demo.query).toString()}`}
            >
              {demo.title}
            </Link>
          </div>
          <div>
            <p style={{ margin: "0 0 10px" }}>{demo.summary}</p>
            <ul style={{ margin: "0 0 10px 16px", padding: 0 }}>
              {demo.bullets.map((bullet) => (
                <li key={bullet} className="note">
                  {bullet}
                </li>
              ))}
            </ul>
            <p style={{ margin: 0 }}>
              <strong>Question:</strong> {demo.question}
            </p>
          </div>
          <div />
        </div>
      ))}
      <p className="note" style={{ marginTop: 14 }}>
        Each demo loads the inputs into the Utilities page; press Update to run it.
      </p>
    </main>
  );
}
