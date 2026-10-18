import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Masthead, Navigation, SiteFooter } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "Icepack",
  description:
    "Analysis and design of nucleic acid structures, devices and systems: partition functions, MFE structures, equilibrium base-pairing probabilities, test tube concentrations, melts and sequence design.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Masthead />
          <Suspense fallback={<div style={{ height: 46 }} />}>
            <Navigation />
          </Suspense>
          {children}
          <Suspense fallback={<div style={{ height: 56 }} />}>
            <SiteFooter />
          </Suspense>
        </div>
      </body>
    </html>
  );
}
