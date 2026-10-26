import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { EVENT_LABEL, type LedgerEvent } from "@/lib/ledger/events";
import { formatDay } from "@/lib/ledger/format";
import { useDemoFlag, useLedger, useYearModel } from "@/lib/ledger/store";

export function LedgerView({ year }: { year: string }) {
  const model = useYearModel(year);
  const restore = useLedger((state) => state.restore);
  const demo = useDemoFlag();
  const [armed, setArmed] = useState(false);

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted uppercase">Chain of custody</p>
        <h1 className="mt-2 font-display text-display font-medium tracking-tight">Every change is an entry</h1>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          {model.chainOk
            ? `SHA-256 chain intact. ${model.events.length} entries. The hash of each entry includes the hash before it.`
            : `The chain breaks at entry ${model.brokenAt}.`}{" "}
          The list is the whole record, not only water year {year}.
        </p>
        <div className="mt-4">
          <Badge tone={model.chainOk ? "ok" : "bad"}>{model.chainOk ? "Intact" : "Broken"}</Badge>
        </div>
      </header>

      <ol className="border-t border-line">
        {model.events.map((event) => (
          <li key={event.id} className="border-b border-line">
            <details>
              <summary className="grid gap-1 py-4 sm:grid-cols-[4.5rem_7rem_1fr] sm:items-baseline sm:gap-4">
                <span className="text-xs font-medium text-muted tabular-nums">{event.id}</span>
                <span className="text-sm text-ink">{EVENT_LABEL[event.type]}</span>
                <span className="text-sm text-muted">{event.summary}</span>
              </summary>
              <EventBody event={event} />
            </details>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            restore();
            setArmed(false);
          }}
        >
          {armed ? "Confirm restore" : demo ? "Sample record is loaded" : "Restore sample record"}
        </Button>
        {armed ? (
          <Button variant="quiet" onClick={() => setArmed(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EventBody({ event }: { event: LedgerEvent }) {
  return (
    <div className="grid gap-3 pb-4 text-sm">
      <p className="text-muted">{formatDay(event.at)}</p>
      <p className="font-mono text-xs break-all text-muted">{event.hash}</p>
      <pre className="overflow-x-auto rounded-sm bg-sand p-3 text-xs leading-relaxed text-ink">
        {JSON.stringify(event.payload, null, 2)}
      </pre>
    </div>
  );
}
