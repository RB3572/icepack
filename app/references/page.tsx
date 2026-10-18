export const metadata = { title: "References | Icepack" };

const GROUPS: Array<{ title: string; items: Array<{ text: string; href?: string }> }> = [
  {
    title: "Thermodynamic parameters",
    items: [
      {
        text: "Mathews DH, Disney MD, Childs JL, Schroeder SJ, Zuker M, Turner DH. Incorporating chemical modification constraints into a dynamic programming algorithm for prediction of RNA secondary structure. PNAS 101, 7287-7292 (2004).",
      },
      {
        text: "SantaLucia J Jr, Hicks D. The thermodynamics of DNA structural motifs. Annu Rev Biophys Biomol Struct 33, 415-440 (2004).",
      },
      {
        text: "Turner DH, Mathews DH. NNDB: the nearest neighbor parameter database for predicting stability of nucleic acid secondary structure. Nucleic Acids Res 38, D280-D282 (2010).",
        href: "https://rna.urmc.rochester.edu/NNDB/",
      },
    ],
  },
  {
    title: "Algorithms",
    items: [
      {
        text: "McCaskill JS. The equilibrium partition function and base pair binding probabilities for RNA secondary structure. Biopolymers 29, 1105-1119 (1990).",
      },
      {
        text: "Dirks RM, Pierce NA. A partition function algorithm for nucleic acid secondary structure including pseudoknots. J Comput Chem 24, 1664-1677 (2003).",
      },
      {
        text: "Dirks RM, Bois JS, Schaeffer JM, Winfree E, Pierce NA. Thermodynamic analysis of interacting nucleic acid strands. SIAM Review 49, 65-88 (2007).",
      },
      {
        text: "Zuker M, Stiegler P. Optimal computer folding of large RNA sequences using thermodynamics and auxiliary information. Nucleic Acids Res 9, 133-148 (1981).",
      },
    ],
  },
  {
    title: "Design",
    items: [
      {
        text: "Dirks RM, Lin M, Winfree E, Pierce NA. Paradigms for computational nucleic acid design. Nucleic Acids Res 32, 1392-1403 (2004).",
      },
      {
        text: "Zadeh JN, Wolfe BR, Pierce NA. Nucleic acid sequence design via efficient ensemble defect optimization. J Comput Chem 32, 439-452 (2011).",
      },
      {
        text: "Wolfe BR, Pierce NA. Sequence design for a test tube of interacting nucleic acid strands. ACS Synth Biol 4, 1086-1100 (2015).",
      },
    ],
  },
  {
    title: "Systems analysed in the demos",
    items: [
      {
        text: "Dirks RM, Pierce NA. Triggered amplification by hybridization chain reaction. PNAS 101, 15275-15278 (2004).",
      },
    ],
  },
];

export default function ReferencesPage() {
  return (
    <main className="panel prose">
      <h1>References</h1>
      <p>
        The energy model, the algorithms and the design objective implemented here
        follow the published literature below.
      </p>
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <ul>
            {group.items.map((item) => (
              <li key={item.text} style={{ marginBottom: 6 }}>
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {item.text}
                  </a>
                ) : (
                  item.text
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
