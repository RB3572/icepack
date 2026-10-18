import { UnlockForm } from "./UnlockForm";

export const metadata = { title: "Icepack" };

export default function UnlockPage() {
  return (
    <main className="panel">
      <div style={{ maxWidth: 380, margin: "48px auto 72px", textAlign: "center" }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          This site is password protected
        </div>
        <p className="note" style={{ marginBottom: 18 }}>
          Enter the password to reach the analysis, design and utilities pages.
        </p>
        <UnlockForm />
      </div>
    </main>
  );
}
