import { Suspense } from "react";
import { AnalysisResults } from "./AnalysisResults";

export const metadata = { title: "Analysis results | Newerpack" };

export default function AnalysisResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="panel">
      <Suspense fallback={<p className="note">Loading results…</p>}>
        <Results params={params} />
      </Suspense>
    </main>
  );
}

async function Results({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalysisResults jobId={id} />;
}
