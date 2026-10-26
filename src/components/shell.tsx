import type { ReactNode } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { yearsIn } from "@/lib/ledger/derive";
import { useDemoFlag, useLedger, useYearModel } from "@/lib/ledger/store";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

const routeApi = getRouteApi("/");

const VIEWS = [
  { id: "challenge", label: "Challenge" },
  { id: "ingestion", label: "Meters" },
  { id: "pumps", label: "Pumps" },
  { id: "ledger", label: "Ledger" },
  { id: "package", label: "Package" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const search = routeApi.useSearch();
  const events = useLedger((state) => state.events);
  const model = useYearModel(search.year);
  const demo = useDemoFlag();
  const years = yearsIn(events);

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-widest text-muted uppercase">Evidence record</p>
              <Link
                to="/"
                search={{ view: "challenge", year: search.year }}
                className="font-display text-xl font-medium tracking-tight text-ink"
              >
                Groundwater Evidence Ledger
              </Link>
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Water year">
              {years.map((year) => (
                <Link
                  key={year}
                  to="/"
                  search={{ view: search.view, year }}
                  aria-current={year === search.year ? "page" : undefined}
                  className={cn(buttonClass(year === search.year ? "primary" : "secondary"), "min-w-16 px-3")}
                >
                  {year}
                </Link>
              ))}
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto" aria-label="Sections">
            {VIEWS.map((view) => (
              <Link
                key={view.id}
                to="/"
                search={{ view: view.id, year: search.year }}
                aria-current={search.view === view.id ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium",
                  search.view === view.id ? "border-ink text-ink" : "border-transparent text-muted",
                )}
              >
                {view.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="no-print mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <p className="max-w-3xl text-sm text-muted">
          {demo
            ? "Sample ranch, so the record can be read before your own meters are imported. Not a live utility session."
            : "This browser is holding your revisions. The original reads stay in the chain. Restore the sample from the ledger if you want the demonstration back."}
        </p>
        {!model.chainOk ? (
          <p className="mt-3 text-sm text-ink">
            <span className="mr-2 inline-flex rounded-full bg-bad-bg px-2.5 py-1 text-xs font-medium text-bad">
              Chain broken
            </span>
            Entry {model.brokenAt} does not hash. Restore the sample before relying on an export.
          </p>
        ) : null}
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="no-print mx-auto w-full max-w-6xl px-4 pb-12 text-xs text-muted sm:px-6">
        The ledger prepares a pump-based extraction record for comparison with an agency notice. It does not file
        the challenge or replace the agency's system. Demonstration clock: October 12, 2026.
      </footer>
    </div>
  );
}
