import { FrozenPadlock } from "@/components/IceScene";
import { UnlockForm } from "./UnlockForm";

export const metadata = { title: "Icepack" };

export default function UnlockPage() {
  return (
    <main className="panel">
      <div className="frost-card" style={{ maxWidth: 400, margin: "28px auto 44px", textAlign: "center" }}>
        <FrozenPadlock />
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
