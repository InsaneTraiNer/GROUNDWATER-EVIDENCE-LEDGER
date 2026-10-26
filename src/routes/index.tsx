import { createFileRoute } from "@tanstack/react-router";
import { ChallengeView } from "@/components/challenge-view";
import { IngestionView } from "@/components/ingestion-view";
import { LedgerView } from "@/components/ledger-view";
import { PackageView } from "@/components/package-view";
import { PumpsView } from "@/components/pumps-view";
import { Shell } from "@/components/shell";
import { useHydrateLedger } from "@/lib/ledger/store";

const VIEWS = ["challenge", "ingestion", "pumps", "ledger", "package"] as const;

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const view = VIEWS.find((item) => item === search.view) ?? "challenge";
    const year = typeof search.year === "string" && /^20\d{2}$/.test(search.year) ? search.year : "2026";
    return { view, year };
  },
  component: Home,
});

function Home() {
  useHydrateLedger();
  const { view, year } = Route.useSearch();
  return (
    <Shell>
      {view === "challenge" ? <ChallengeView year={year} /> : null}
      {view === "ingestion" ? <IngestionView year={year} /> : null}
      {view === "pumps" ? <PumpsView year={year} /> : null}
      {view === "ledger" ? <LedgerView year={year} /> : null}
      {view === "package" ? <PackageView year={year} /> : null}
    </Shell>
  );
}
