import { Suspense } from "react";
import { DesignResults } from "./DesignResults";

export const metadata = { title: "Design results | Newerpack" };

export default function DesignResultsPage({
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
  return <DesignResults jobId={id} />;
}
