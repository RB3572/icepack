"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FooterWaves, MastheadScene } from "@/components/IceScene";

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
      <MastheadScene />
      <div className="masthead-inner">
        <Link className="wordmark" href="/">
          <span className="logo-mark" aria-hidden="true" />
          <span className="wordmark-text">
            <span className="wordmark-name">
              ice<em>pack</em>
            </span>
            <span className="wordmark-tag">nucleic acid design</span>
          </span>
        </Link>
      </div>
    </header>
  );
}

export function Navigation() {
  const pathname = usePathname() ?? "/";
  const section = PRIMARY.find((entry) => pathname.startsWith(entry.match));
  const sub = section ? SUBNAV[section.match] : undefined;

  // Behind the password gate every link is a dead end, so show the bare bar.
  if (pathname === "/unlock") {
    return (
      <>
        <nav className="navbar" aria-hidden="true">
          <span className="spacer" style={{ padding: "7px 0" }}>&nbsp;</span>
        </nav>
        <nav className="subnav" aria-hidden="true">
          <span style={{ padding: "3px 0" }}>&nbsp;</span>
        </nav>
      </>
    );
  }

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
  const pathname = usePathname() ?? "/";
  const locked = pathname === "/unlock";
  return (
    <footer className="sitefoot">
      <FooterWaves />
      <div className="sitefoot-body">
        {!locked && (
          <nav>
            {FOOTER.map((entry) => (
              <Link key={entry.href} href={entry.href}>
                {entry.label}
              </Link>
            ))}
          </nav>
        )}
        <div>
          Icepack is an independent open implementation. It is not affiliated with
          NUPACK or Caltech.
        </div>
      </div>
    </footer>
  );
}
