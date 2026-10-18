import { UtilitiesClient } from "./UtilitiesClient";

export const metadata = { title: "Utilities | Icepack" };

export default function UtilitiesPage() {
  return (
    <main className="panel">
      <UtilitiesClient />
    </main>
  );
}
