import { useState } from "react";
import { Brief } from "@/components/brief";
import { Button, Field, TextInput } from "@/components/ui";
import type { Identity } from "@/lib/ledger/catalog";
import { briefHtml, buildBrief, evidenceData } from "@/lib/ledger/package";
import { slug } from "@/lib/ledger/format";
import { useLedger, useYearModel } from "@/lib/ledger/store";

export function PackageView({ year }: { year: string }) {
  const model = useYearModel(year);
  const sections = buildBrief(model);
  const base = slug(`${model.identity.ranchName}-${model.identity.block}-wy${year}`) || `water-year-${year}`;

  return (
    <div className="grid gap-8">
      <header className="no-print">
        <p className="text-xs font-medium tracking-widest text-muted uppercase">Export</p>
        <h1 className="mt-2 font-display text-display font-medium tracking-tight">Evidence package</h1>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          The brief separates source reads, attribution, assumptions, arithmetic, and the volume. The JSON is the
          same record in a form another person can recompute.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const generatedAt = new Date().toISOString();
              download(`${base}.html`, "text/html", briefHtml(model, generatedAt));
            }}
          >
            Download brief
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const generatedAt = new Date().toISOString();
              download(`${base}.json`, "application/json", JSON.stringify(evidenceData(model, generatedAt), null, 2));
            }}
          >
            Download data
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </header>

      <IdentityEditor identity={model.identity} />
      <Brief sections={sections} />
    </div>
  );
}

function IdentityEditor({ identity }: { identity: Identity }) {
  const reviseIdentity = useLedger((state) => state.reviseIdentity);
  const [form, setForm] = useState(identity);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <details className="no-print rounded-xl border border-line bg-cream p-4">
      <summary className="text-sm font-medium">Edit the record caption</summary>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const message = reviseIdentity({ ...form, acres: Number(form.acres) });
          setError(message);
          setSaved(message == null);
        }}
      >
        {(
          [
            ["ranchName", "Ranch"],
            ["block", "Block"],
            ["operator", "Operator"],
            ["county", "County"],
            ["apn", "APN"],
            ["crop", "Crop"],
            ["utility", "Utility"],
            ["account", "Account"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <TextInput
              value={form[key]}
              onChange={(event) => {
                setSaved(false);
                setForm({ ...form, [key]: event.target.value });
              }}
            />
          </Field>
        ))}
        <Field label="Acres">
          <TextInput
            inputMode="decimal"
            value={String(form.acres)}
            onChange={(event) => {
              setSaved(false);
              setForm({ ...form, acres: Number(event.target.value) });
            }}
          />
        </Field>
        {error ? <p className="text-sm text-bad sm:col-span-2">{error}</p> : null}
        {saved ? <p className="text-sm text-ok sm:col-span-2">Caption appended to the chain.</p> : null}
        <Button type="submit">Append caption</Button>
      </form>
    </details>
  );
}

function download(filename: string, type: string, body: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
