# Newerpack

Analysis and design of nucleic acid structures, devices and systems — a web
application plus a self-contained TypeScript thermodynamics engine.

It implements the standard unpseudoknotted secondary structure model end to end:
partition functions over complexes of interacting strands, minimum free energy
structures, equilibrium base-pairing probabilities, equilibrium concentrations in
a test tube, melt profiles, ensemble sizes and defects, and sequence design
against a multi-tube ensemble objective.

## Running it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. No account or service is needed — every
calculation runs in the application.

## Password gate

The whole site sits behind a shared password. `proxy.ts` checks every request:
pages redirect to `/unlock`, and API routes answer `401` with JSON so a fetch
gets a usable error rather than a login page where it expected data. The
destination you were heading for is remembered in a short-lived cookie and
restored after unlocking.

The access cookie holds `sha256("newerpack:v1:" + password)` rather than a
"logged in" flag, so it cannot be forged by someone who does not know the
password. Bump `VERSION` in `lib/server/access.ts` to invalidate every existing
session.

The password is read from `SITE_PASSWORD`, falling back to a value in
`lib/server/access.ts` so a fresh checkout works with no configuration.

> **This repository is public.** The fallback password is therefore readable by
> anyone who finds the repo. Set `SITE_PASSWORD` in the hosting environment
> (Vercel: Project Settings -> Environment Variables, then redeploy) to use a
> password that is not in the source.

## Pages

| Page                             | What it does                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/utilities`                     | One complex: draw a structure, evaluate its free energy, probability and ensemble defect, show the pair probability matrix, find the MFE structure, or design a sequence for a structure. |
| `/analysis/input`                | A test tube of interacting strands: complex free energies, equilibrium concentrations, MFE structures, pair probabilities, melt profiles. |
| `/design/input`                  | Sequence design over a multi-tube ensemble with domains, target structures, target concentrations and IUPAC constraints.       |
| `/model`, `/definitions`, `/references`, `/faq` | What the engine models, the vocabulary, the literature it follows, and the known limitations.                  |

Each section ships with demos that load a complete job.

## Engine

The engine has no runtime dependencies and can be used on its own:

```ts
import { encodeSequence } from "@/lib/nupack/alphabet";
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
```

| Module                             | Contents                                                          |
| ---------------------------------- | ----------------------------------------------------------------- |
| `lib/nupack/model.ts`              | Energy model, nicked-sequence representation, temperature scaling  |
| `lib/nupack/pf.ts`                 | Partition function (inside) and pair probabilities (outside)       |
| `lib/nupack/mfe.ts`                | MFE structure and traceback                                        |
| `lib/nupack/energy.ts`             | Free energy of one specified structure, by loop decomposition      |
| `lib/nupack/complex.ts`            | Complexes, circular orderings, symmetry correction                 |
| `lib/nupack/concentrations.ts`     | Equilibrium concentration solver                                   |
| `lib/nupack/analysis.ts`           | Test tube analysis, melt profiles, tube pair fractions             |
| `lib/nupack/design.ts`             | Multi-tube ensemble defect optimisation                            |
| `lib/nupack/ensemble.ts`           | Ensemble size                                                      |
| `lib/nupack/structure.ts`          | dot-parens-plus, RLE dot-parens-plus and DU+ notations             |
| `lib/nupack/layout.ts`             | Secondary structure layout for drawing                             |

### Connectivity

A complex is one concatenated sequence with a nick wherever one strand ends and
the next begins. A loop whose unpaired regions span a nick is part of the
exterior loop and is scored as such. The polymer graph of an unpseudoknotted
structure is connected exactly when the exterior loop contains no nick and every
other loop contains at most one — two nicks in one loop cut its boundary cycle
into two arcs that no unpseudoknotted base pair can join. The recursions enforce
that directly, so the partition function covers connected structures only.

### Parameters

Nearest-neighbour parameters are built from the published Turner/Mathews 2004
(RNA) and SantaLucia/Mathews 2004 (DNA) sets:

```bash
node lib/nupack/params/build-params.mjs
```

That converts a ViennaRNA-format `.par` file in `lib/nupack/params/raw/` into the
JSON the engine loads. Point it at a different file to swap parameter sets.

## Checks

```bash
npm run check:pf        # partition function and pair probabilities vs exhaustive enumeration
npm run check:mfe       # MFE vs exhaustive enumeration, and published reference energies
npm run check:ensemble  # ensemble sizes vs published counts
npm run check:design    # design reaches its stop condition on known targets
```

`check:pf` and `check:mfe` enumerate every connected unpseudoknotted structure of
short single strands, duplexes and three-strand complexes and compare against the
dynamic program; free energies and pair probabilities agree to floating-point
precision. `check:ensemble` reproduces the published count of 2349 structures for
`ATAGTTTTCTCGAAAACGAT`.

## Known limitations

- **Coaxial stacking is not modelled.** Ensemble options that mention coaxial
  stacking fall back to terminal-mismatch and dangle treatment. Single strands
  agree closely with the reference implementation — structure free energies
  typically within a few tenths of a kcal/mol — while complexes with nicks
  adjacent to helices come out less stable by roughly 1–2 kcal/mol per nicked
  junction.
- **Mixed-material jobs are not supported.** RNA/DNA and RNA/2′OMe-RNA hybrids
  need hybrid nearest-neighbour tables that are not part of the published
  single-material sets; 2′OMe-RNA is evaluated with the RNA set.

Both are limitations of the parameterisation, not of the algorithms: the
recursions, the connectivity handling, the outside algorithm and the
concentration solver are exact for the model as stated.

Newerpack is an independent open implementation. It is not affiliated with
NUPACK or Caltech.
