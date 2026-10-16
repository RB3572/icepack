"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY = [
  { href: "/analysis/input", label: "Analysis", match: "/analysis" },
  { href: "/design/input", label: "Design", match: "/design" },
  { href: "/utilities", label: "Utilities", match: "/utilities" },
];

const SUBNAV: Record<string, Array<{ href: string; label: string }>> = {
  "/analysis": [
    { href: "/analysis/input", label: "Input" },
    { href: "/analysis/intro", label: "Intro" },
    { href: "/analysis/demos", label: "Demos" },
  ],
  "/design": [
    { href: "/design/input", label: "Input" },
    { href: "/design/intro", label: "Intro" },
    { href: "/design/demos", label: "Demos" },
  ],
  "/utilities": [
    { href: "/utilities/intro", label: "Intro" },
    { href: "/utilities/demos", label: "Demos" },
  ],
};

const FOOTER = [
  { href: "/", label: "Overview" },
  { href: "/definitions", label: "Definitions" },
  { href: "/references", label: "References" },
  { href: "/model", label: "Model" },
  { href: "/faq", label: "FAQ" },
];

export function Masthead() {
  return (
    <header className="masthead">
      <Link className="wordmark" href="/">
        <span className="wordmark-name">
          newer<em>pack</em>
        </span>
        <span className="wordmark-tag">nucleic acid design</span>
      </Link>
      <div className="newsbar">
        <p>
          <strong>Open engine:</strong> every calculation on this site runs in this
          application - partition function, MFE, pair probabilities, equilibrium
          concentrations, melts and sequence design.
        </p>
        <p>
          Thermodynamics from the published Turner 2004 (RNA) and SantaLucia /
          Mathews 2004 (DNA) nearest-neighbour parameter sets.{" "}
          <Link href="/model">Model details</Link>
        </p>
      </div>
    </header>
  );
}

export function Navigation() {
  const pathname = usePathname() ?? "/";
  const section = PRIMARY.find((entry) => pathname.startsWith(entry.match));
  const sub = section ? SUBNAV[section.match] : undefined;

  return (
    <>
      <nav className="navbar">
        {PRIMARY.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            data-active={pathname.startsWith(entry.match)}
          >
            {entry.label}
          </Link>
        ))}
        <span className="spacer" />
        <Link href="/download" data-active={pathname.startsWith("/download")}>
          Download
        </Link>
      </nav>
      <nav className="subnav">
        {(sub ?? []).map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            data-active={
              pathname === entry.href ||
              (entry.label === "Input" && pathname.includes("/results"))
            }
          >
            {entry.label}
          </Link>
        ))}
        {(!sub || sub.length === 0) && <span style={{ padding: "3px 0" }}>&nbsp;</span>}
      </nav>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="sitefoot">
      <nav>
        {FOOTER.map((entry) => (
          <Link key={entry.href} href={entry.href}>
            {entry.label}
          </Link>
        ))}
      </nav>
      <div>
        Newerpack is an independent open implementation. It is not affiliated with
        NUPACK or Caltech.
      </div>
    </footer>
  );
}
