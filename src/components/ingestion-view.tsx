import { useState } from "react";
import { Badge, Button, DataTable, Panel, TextArea } from "@/components/ui";
import { CSV_HEADER } from "@/lib/ledger/csv";
import { DEMO_TODAY, WELLS } from "@/lib/ledger/catalog";
import { formatDay, formatKwh, formatMonth } from "@/lib/ledger/format";
import { useLedger, useYearModel } from "@/lib/ledger/store";

export function IngestionView({ year }: { year: string }) {
  const model = useYearModel(year);
  const checkArchive = useLedger((state) => state.checkArchive);
  const importCsv = useLedger((state) => state.importCsv);
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(model.lastSync?.summary ?? null);

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted uppercase">PG&E archive</p>
        <h1 className="mt-2 font-display text-display font-medium tracking-tight">Meter reads, as they arrived</h1>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Monthly settled reads for account {model.identity.account}. A later import does not erase a month. It
          appends a replacement, and the first read stays in the chain.
        </p>
      </header>

      <Panel className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">Archive check</h2>
            <p className="mt-1 text-sm text-muted">
              {model.lastSync
                ? `Last check ${formatDay(model.lastSync.at)}. Demonstration clock ${formatDay(DEMO_TODAY)}.`
                : "No archive check is on the chain yet."}
            </p>
          </div>
          <Button
            onClick={() => {
              const result = checkArchive();
              setSyncNote(result.appended ? "Check appended to the chain." : result.summary);
            }}
          >
            Check the archive
          </Button>
        </div>
        {syncNote ? <p className="text-sm text-ink">{syncNote}</p> : null}
      </Panel>

      <div className="grid gap-4">
        {model.wells.map((entry) => (
          <Panel key={entry.well.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-medium tracking-tight">{entry.well.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  Meter {entry.well.meterId} · Service {entry.well.serviceId} · {entry.well.role}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums">{formatKwh(entry.meterKwh)}</p>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12">
              {model.months.map((month) => {
                const cell = month.wells.find((item) => item.wellId === entry.well.id);
                const state = !month.expected ? "later" : cell?.meterKwh == null ? "gap" : cell.quality === "provisional" ? "partial" : "in";
                const label = state === "later" ? "Later" : state === "gap" ? "Gap" : state === "partial" ? "Part" : "In";
                return (
                  <div
                    key={month.start}
                    className={
                      state === "in"
                        ? "flex h-14 flex-col items-center justify-center rounded-sm bg-accent text-on-accent"
                        : state === "partial"
                          ? "flex h-14 flex-col items-center justify-center rounded-sm bg-sand text-ink"
                          : state === "gap"
                            ? "flex h-14 flex-col items-center justify-center rounded-sm bg-bad-bg text-bad"
                            : "flex h-14 flex-col items-center justify-center rounded-sm border border-line text-muted"
                    }
                  >
                    <span className="text-xs">{month.short}</span>
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-medium tracking-tight">Active reads</h2>
          <Badge tone="neutral">{model.activeReads.length} rows</Badge>
        </div>
        <div className="mt-4">
          <DataTable
            columns={["Month", "Well", "Meter", "kWh", "Days", "Quality", "Origin"]}
            rows={model.activeReads
              .slice()
              .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.meterId.localeCompare(b.meterId))
              .map((read) => {
                const well = WELLS.find((item) => item.meterId === read.meterId);
                return [
                  formatMonth(read.periodStart),
                  well?.name ?? read.meterId,
                  read.meterId,
                  formatKwh(read.kwh).replace(" kWh", ""),
                  `${read.days}/${read.daysInMonth}`,
                  read.quality,
                  read.origin === "pge-archive" ? "Archive" : "Import",
                ];
              })}
          />
        </div>
        {model.supersededCount > 0 ? (
          <p className="mt-3 text-sm text-muted">
            {model.supersededCount} superseded read{model.supersededCount === 1 ? "" : "s"} stay in the ledger and are
            excluded here.
          </p>
        ) : null}
      </Panel>

      <Panel>
        <h2 className="font-display text-2xl font-medium tracking-tight">Import a CSV</h2>
        <p className="mt-2 text-sm text-muted">
          Header <span className="font-mono text-ink">{CSV_HEADER}</span>. One calendar month per row. Known meters:{" "}
          {WELLS.map((well) => well.meterId).join(", ")}.
        </p>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const result = importCsv(csv);
            if (!result.ok) {
              setError(result.error);
              setMessage(null);
              return;
            }
            setError(null);
            setMessage(
              result.replaced > 0
                ? `${result.added} reads appended. ${result.replaced} replaced an earlier month.`
                : `${result.added} reads appended.`,
            );
            setCsv("");
          }}
        >
          <TextArea
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder={CSV_HEADER}
            spellCheck={false}
            aria-label="CSV reads"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Append reads</Button>
            <label className="inline-flex h-11 cursor-pointer items-center rounded-sm border border-line bg-cream px-4 text-sm font-medium">
              Load a file
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void file.text().then((text) => setCsv(text));
                }}
              />
            </label>
            <Button
              variant="quiet"
              onClick={() => {
                const blob = new Blob([`${CSV_HEADER}\n`], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "meter-reads.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download a template
            </Button>
          </div>
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          {message ? <p className="text-sm text-ok">{message}</p> : null}
        </form>
      </Panel>
    </div>
  );
}
