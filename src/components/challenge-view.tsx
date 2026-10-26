import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MonthChart } from "@/components/month-chart";
import { Badge, Button, DataTable, Field, Panel, TextArea, TextInput, buttonClass } from "@/components/ui";
import { formatAf, formatNum, formatPct, formatUsd } from "@/lib/ledger/format";
import { challengePoints } from "@/lib/ledger/package";
import { useLedger, useYearModel } from "@/lib/ledger/store";
import type { NoticeInput } from "@/lib/ledger/events";

export function ChallengeView({ year }: { year: string }) {
  const model = useYearModel(year);
  const identity = model.identity;
  const comparison = model.comparison;
  const points = challengePoints(model);
  const chart = model.months
    .filter((month) => month.totalAf != null)
    .map((month) => ({ label: month.short, af: Number(month.totalAf?.toFixed(2)) }));

  const gap = comparison ? comparison.noticeAf - comparison.ledgerAf : 0;
  const headline = !comparison
    ? `Water year ${year} is on the meters. No notice is on file.`
    : !comparison.comparable
      ? "A notice is on file, but the meter year is not closed."
      : gap > 0
        ? `The notice counts ${formatAf(gap)} more than the pumps.`
        : gap < 0
          ? `The pumps record ${formatAf(Math.abs(gap))} more than the notice.`
          : "The notice and the pumps land on the same volume.";

  return (
    <div className="grid gap-10">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)] lg:items-end">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted uppercase">
            {identity.ranchName} · {identity.block} · Water year {year}
          </p>
          <h1 className="mt-2 font-display text-display font-medium tracking-tight text-ink">{headline}</h1>
          <p className="mt-4 max-w-2xl text-sm text-muted">
            {identity.operator} · {formatNum(identity.acres, 0)} acres of {identity.crop.toLowerCase()} · APN{" "}
            {identity.apn} · {identity.county}. {identity.utility} account {identity.account}.
          </p>
          {comparison?.comparable && comparison.disputeAf > 0 ? (
            <p className="mt-3 max-w-2xl text-sm text-ink">
              At the notice's own rate, the difference in volume above the allocation is{" "}
              <span className="tabular-nums">{formatUsd(comparison.disputeUsd)}</span>.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={model.fullYear ? "ok" : "warn"}>{model.fullYear ? "Full year settled" : "Year still open"}</Badge>
          <Badge tone={model.portfolioWithinBenchmark ? "ok" : "warn"}>
            {model.portfolioWithinBenchmark ? "Year band within 5%" : "Year band not within 5%"}
          </Badge>
          {model.chainOk ? <Badge tone="neutral">Chain intact</Badge> : <Badge tone="bad">Chain broken</Badge>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel>
          <h2 className="font-display text-2xl font-medium tracking-tight">Monthly volume</h2>
          <p className="mt-2 text-sm text-muted">Acre-feet from pump electricity. The table is the record; the bars repeat it.</p>
          <div className="mt-4">
            <MonthChart data={chart} />
          </div>
          <div className="mt-4">
            <DataTable
              columns={["Month", ...model.wells.map((entry) => entry.well.name), "Total"]}
              rows={model.months.map((month) => [
                month.label,
                ...month.wells.map((entry) => (entry.af == null ? "—" : formatNum(entry.af, 2))),
                month.totalAf == null ? "—" : formatNum(month.totalAf, 2),
              ])}
            />
          </div>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl font-medium tracking-tight">Worksheet</h2>
          {comparison ? (
            <>
              <p className="mt-2 text-sm text-muted">
                {comparison.comparable
                  ? "Rounded to 0.01 acre-foot before subtracting."
                  : "Shown for the record. Do not treat a partial year as a full-year dispute."}
              </p>
              <dl className="mt-4 grid gap-3 text-sm">
                <Row k="Notice net" v={formatAf(comparison.noticeAf)} />
                <Row k="Ledger" v={formatAf(comparison.ledgerAf)} />
                <Row k="Allocation" v={formatAf(comparison.allocationAf)} />
                <Row k="Notice above allocation" v={formatAf(comparison.noticeExcessAf)} />
                <Row k="Ledger above allocation" v={formatAf(comparison.ledgerExcessAf)} />
                <Row k="Difference" v={formatAf(comparison.disputeAf)} />
                <Row k="Rate" v={`${formatUsd(comparison.notice.ratePerAf)} / AF`} />
              </dl>
              <p className="mt-4 border-t border-line pt-4 font-display text-3xl font-medium tracking-tight tabular-nums">
                {formatUsd(comparison.disputeUsd)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {comparison.disputeAf > 0
                  ? "Notice excess minus ledger excess, times the notice rate."
                  : "No reduction to claim. The ledger excess is not below the notice."}
              </p>
              <p className="mt-3 text-sm text-muted">
                Band {formatAf(comparison.low)} to {formatAf(comparison.high)}
                {model.relative != null ? ` (${formatPct(model.relative)})` : ""}.{" "}
                {comparison.outside ? "Notice is outside it." : "Notice is inside it."}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">Enter the notice when it arrives. The meters do not wait for it.</p>
              <p className="mt-4 font-display text-3xl font-medium tracking-tight tabular-nums">
                {formatAf(model.preciseAf)}
              </p>
              <p className="mt-1 text-sm text-muted">Year to date, unrounded in the chain, shown here in full.</p>
            </>
          )}
          <Link to="/" search={{ view: "package", year }} className={`${buttonClass("primary")} mt-5 w-full`}>
            Open the evidence package
          </Link>
        </Panel>
      </div>

      <section className="grid gap-4">
        <h2 className="font-display text-2xl font-medium tracking-tight">What the package preserves</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {points.map((point) => (
            <Panel key={point.title}>
              <h3 className="text-sm font-medium text-ink">{point.title}</h3>
              <p className="mt-2 text-sm text-muted">{point.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <NoticeEditor
        key={`${year}:${comparison?.notice.eventId ?? "new"}`}
        year={year}
        initial={comparison?.notice ?? null}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-ink tabular-nums">{v}</dd>
    </div>
  );
}

function NoticeEditor({ year, initial }: { year: string; initial: NoticeInput | null }) {
  const reviseNotice = useLedger((state) => state.reviseNotice);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    agency: initial?.agency ?? "",
    noticeNo: initial?.noticeNo ?? "",
    issuedOn: initial?.issuedOn ?? "2026-10-12",
    etaAf: String(initial?.etaAf ?? ""),
    precipCreditAf: String(initial?.precipCreditAf ?? ""),
    surfaceCreditAf: String(initial?.surfaceCreditAf ?? ""),
    allocationAfPerAcre: String(initial?.allocationAfPerAcre ?? ""),
    ratePerAf: String(initial?.ratePerAf ?? ""),
    methodNote: initial?.methodNote ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <details className="rounded-xl border border-line bg-cream p-4">
      <summary className="text-sm font-medium text-ink">
        {initial ? "Revise the imported notice" : "Enter a notice"}
      </summary>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const message = reviseNotice({
            waterYear: year,
            agency: form.agency,
            noticeNo: form.noticeNo,
            issuedOn: form.issuedOn,
            etaAf: Number(form.etaAf),
            precipCreditAf: Number(form.precipCreditAf),
            surfaceCreditAf: Number(form.surfaceCreditAf),
            allocationAfPerAcre: Number(form.allocationAfPerAcre),
            ratePerAf: Number(form.ratePerAf),
            methodNote: form.methodNote,
          });
          setError(message);
          setSaved(message == null);
        }}
      >
        <Field label="Agency">
          <TextInput value={form.agency} onChange={(event) => set("agency", event.target.value)} />
        </Field>
        <Field label="Notice number">
          <TextInput value={form.noticeNo} onChange={(event) => set("noticeNo", event.target.value)} />
        </Field>
        <Field label="Issued">
          <TextInput type="date" value={form.issuedOn} onChange={(event) => set("issuedOn", event.target.value)} />
        </Field>
        <Field label="Evapotranspiration, AF">
          <TextInput inputMode="decimal" value={form.etaAf} onChange={(event) => set("etaAf", event.target.value)} />
        </Field>
        <Field label="Precipitation credit, AF">
          <TextInput
            inputMode="decimal"
            value={form.precipCreditAf}
            onChange={(event) => set("precipCreditAf", event.target.value)}
          />
        </Field>
        <Field label="Surface water, AF">
          <TextInput
            inputMode="decimal"
            value={form.surfaceCreditAf}
            onChange={(event) => set("surfaceCreditAf", event.target.value)}
          />
        </Field>
        <Field label="Allocation, AF per acre">
          <TextInput
            inputMode="decimal"
            value={form.allocationAfPerAcre}
            onChange={(event) => set("allocationAfPerAcre", event.target.value)}
          />
        </Field>
        <Field label="Rate, dollars per AF">
          <TextInput inputMode="decimal" value={form.ratePerAf} onChange={(event) => set("ratePerAf", event.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="How the notice says it measured extraction">
            <TextArea value={form.methodNote} onChange={(event) => set("methodNote", event.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit">Append notice to the chain</Button>
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          {saved ? <p className="text-sm text-ok">Appended. The earlier notice is still in the ledger.</p> : null}
        </div>
      </form>
    </details>
  );
}
