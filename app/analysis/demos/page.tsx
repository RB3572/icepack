import Link from "next/link";
import { DEMOS } from "./demos";

export const metadata = { title: "Analysis demos | Newerpack" };

export default function AnalysisDemosPage() {
  return (
    <main className="panel">
      {DEMOS.map((demo) => (
        <div className="demo-row" key={demo.id}>
          <div>
            <Link className="pill" href={`/analysis/input?demo=${demo.id}`}>
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
          <div className="note" style={{ textAlign: "right", minWidth: 120 }}>
            {demo.strands.length} strand species
            <br />
            {demo.tubes.length} test tube{demo.tubes.length > 1 ? "s" : ""}
            <br />
            {demo.melt ? `melt ${demo.melt.min}–${demo.melt.max} °C` : "single temperature"}
          </div>
        </div>
      ))}
    </main>
  );
}
