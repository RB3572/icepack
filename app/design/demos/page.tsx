import Link from "next/link";
import { DESIGN_DEMOS } from "./demos";

export const metadata = { title: "Design demos | Icepack" };

export default function DesignDemosPage() {
  return (
    <main className="panel">
      {DESIGN_DEMOS.map((demo) => (
        <div className="demo-row" key={demo.id}>
          <div>
            <Link className="pill" href={`/design/input?demo=${demo.id}`}>
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
          <div className="note" style={{ textAlign: "right", minWidth: 130 }}>
            {demo.domains.length} domains
            <br />
            {demo.strands.length} strands
            <br />
            stop at {demo.stopCondition}
          </div>
        </div>
      ))}
    </main>
  );
}
