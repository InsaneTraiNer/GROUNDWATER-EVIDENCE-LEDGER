import { useState } from "react";
import { Badge, Button, Field, Panel, TextArea, TextInput } from "@/components/ui";
import { KW_PER_HP, KWH_PER_AF_FOOT, WATER_HP_DIVISOR } from "@/lib/ledger/catalog";
import type { PumpTestInput } from "@/lib/ledger/events";
import { formatAf, formatKwh, formatNum, formatPct } from "@/lib/ledger/format";
import { useLedger, useYearModel } from "@/lib/ledger/store";
import type { WellModel } from "@/lib/ledger/derive";

export function PumpsView({ year }: { year: string }) {
  const model = useYearModel(year);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted uppercase">Water year {year}</p>
        <h1 className="mt-2 font-display text-display font-medium tracking-tight">Each well converts on its own test</h1>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Water horsepower is flow times head, divided by {formatNum(WATER_HP_DIVISOR, 0)}. Input horsepower is
          measured kilowatts divided by {KW_PER_HP}. Efficiency is the ratio. Kilowatt-hours per acre-foot is{" "}
          {KWH_PER_AF_FOOT} times head, divided by that efficiency. Nameplate horsepower is not in the arithmetic.
        </p>
      </header>

      {note ? <p className="text-sm text-ok">{note}</p> : null}

      {model.wells.map((entry) => (
        <WellCard key={entry.test?.eventId ?? entry.well.id} entry={entry} onSaved={setNote} />
      ))}

      <BaselineCard
        key={`${model.baselineKwh}-${model.baselineHistory.length}`}
        monthlyKwh={model.baselineKwh}
        note={model.baselineNote}
        history={model.baselineHistory}
        onSaved={setNote}
      />
    </div>
  );
}

function WellCard({
  entry,
  onSaved,
}: {
  entry: WellModel;
  onSaved: (message: string) => void;
}) {
  const failed = entry.checks.filter((check) => !check.pass).length;
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">{entry.well.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {entry.well.horsepower} HP nameplate · Meter {entry.well.meterId} ·{" "}
            {entry.well.dedicated ? "Dedicated" : "Shared service"}
          </p>
        </div>
        <Badge tone={failed === 0 ? "ok" : "warn"}>{failed === 0 ? "Checks pass" : `${failed} checks fail`}</Badge>
      </div>

      {entry.plant?.valid && entry.test ? (
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Metric k="Efficiency" v={formatPct(entry.plant.ope)} />
          <Metric k="kWh per AF" v={formatNum(entry.plant.kwhPerAf, 2)} />
          <Metric k="Pump energy" v={formatKwh(entry.pumpKwh)} />
          <Metric k="Volume" v={entry.af == null ? "—" : formatAf(entry.af)} />
        </dl>
      ) : (
        <p className="mt-4 text-sm text-muted">No usable test.</p>
      )}

      {entry.plant?.valid ? (
        <p className="mt-4 text-sm text-muted">
          Water horsepower {formatNum(entry.plant.waterHp, 2)}. Input horsepower {formatNum(entry.plant.inputHp, 2)}.
          {!entry.well.dedicated
            ? ` Baseline removed ${formatKwh(entry.baselineRemoved)} from the headquarters meter.`
            : " The meter is taken in full."}
          {entry.flooredMonths > 0 ? ` ${entry.flooredMonths} month${entry.flooredMonths === 1 ? "" : "s"} floored at zero.` : ""}
        </p>
      ) : null}

      <ul className="mt-4">
        {entry.checks.map((check) => (
          <li key={check.label} className="grid gap-1 border-t border-line py-3 text-sm sm:grid-cols-[5rem_1fr]">
            <span className={check.pass ? "font-medium text-ok" : "font-medium text-bad"}>{check.pass ? "Pass" : "Fail"}</span>
            <span>
              <span className="font-medium text-ink">{check.label}. </span>
              <span className="text-muted">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <TestForm
        initial={
          entry.test ?? {
            wellId: entry.well.id,
            testedOn: "2026-10-12",
            tester: "",
            gpm: 0,
            tdhFt: 0,
            inputKw: 0,
            note: "",
          }
        }
        onSaved={onSaved}
      />
    </Panel>
  );
}

function TestForm({ initial, onSaved }: { initial: PumpTestInput; onSaved: (message: string) => void }) {
  const reviseTest = useLedger((state) => state.reviseTest);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    testedOn: initial.testedOn,
    tester: initial.tester,
    gpm: String(initial.gpm || ""),
    tdhFt: String(initial.tdhFt || ""),
    inputKw: String(initial.inputKw || ""),
    note: initial.note,
  });

  return (
    <details className="mt-2 border-t border-line pt-3">
      <summary className="text-sm font-medium">Revise this test</summary>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const message = reviseTest({
            wellId: initial.wellId,
            testedOn: form.testedOn,
            tester: form.tester,
            gpm: Number(form.gpm),
            tdhFt: Number(form.tdhFt),
            inputKw: Number(form.inputKw),
            note: form.note,
          });
          setError(message);
          if (message == null) onSaved("Test appended. The earlier test remains in the chain.");
        }}
      >
        <Field label="Test date">
          <TextInput type="date" value={form.testedOn} onChange={(event) => setForm({ ...form, testedOn: event.target.value })} />
        </Field>
        <Field label="Tester">
          <TextInput value={form.tester} onChange={(event) => setForm({ ...form, tester: event.target.value })} />
        </Field>
        <Field label="Flow, gpm">
          <TextInput inputMode="decimal" value={form.gpm} onChange={(event) => setForm({ ...form, gpm: event.target.value })} />
        </Field>
        <Field label="Total dynamic head, feet">
          <TextInput inputMode="decimal" value={form.tdhFt} onChange={(event) => setForm({ ...form, tdhFt: event.target.value })} />
        </Field>
        <Field label="Input, kW">
          <TextInput inputMode="decimal" value={form.inputKw} onChange={(event) => setForm({ ...form, inputKw: event.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note">
            <TextArea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </Field>
        </div>
        {error ? <p className="text-sm text-bad sm:col-span-2">{error}</p> : null}
        <Button type="submit">Append test</Button>
      </form>
    </details>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{k}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums">{v}</dd>
    </div>
  );
}

function BaselineCard({
  monthlyKwh,
  note,
  history,
  onSaved,
}: {
  monthlyKwh: number;
  note: string;
  history: { at: string; monthlyKwh: number; note: string }[];
  onSaved: (message: string) => void;
}) {
  const reviseBaseline = useLedger((state) => state.reviseBaseline);
  const [error, setError] = useState<string | null>(null);
  const [kwh, setKwh] = useState(String(monthlyKwh));
  const [reason, setReason] = useState(note);

  return (
    <Panel>
      <h2 className="font-display text-2xl font-medium tracking-tight">Headquarters baseline</h2>
      <p className="mt-2 text-sm text-muted">
        Subtracted from Well 2 only. The current figure is {formatKwh(monthlyKwh)} per full month, scaled by days
        when a month is partial.
      </p>
      <ul className="mt-4 grid gap-3">
        {history.map((entry) => (
          <li key={entry.at} className="border-t border-line pt-3 text-sm">
            <p className="font-medium tabular-nums">{formatKwh(entry.monthlyKwh)} per month</p>
            <p className="mt-1 text-muted">{entry.note}</p>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 grid gap-4 border-t border-line pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const message = reviseBaseline(Number(kwh), reason);
          setError(message);
          if (message == null) onSaved("Baseline appended. The earlier figure remains in the chain.");
        }}
      >
        <Field label="Monthly baseline, kWh">
          <TextInput inputMode="decimal" value={kwh} onChange={(event) => setKwh(event.target.value)} />
        </Field>
        <Field label="Why this figure">
          <TextArea value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
        <Button type="submit">Append baseline</Button>
      </form>
    </Panel>
  );
}
