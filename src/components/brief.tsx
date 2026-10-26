import { DataTable } from "@/components/ui";
import type { Section } from "@/lib/ledger/package";

export function Brief({ sections }: { sections: Section[] }) {
  return (
    <article className="print-sheet rounded-xl border border-line bg-cream px-4 py-6 sm:px-8">
      <p className="text-xs font-medium tracking-widest text-muted uppercase">Groundwater Evidence Ledger</p>
      {sections.map((section) => (
        <section key={section.id} className="mt-8 border-t border-line pt-6">
          <p className="text-xs font-medium tracking-widest text-muted uppercase">{section.kicker}</p>
          <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-ink">{section.title}</h2>
          <div className="mt-4 grid gap-4">
            {section.blocks.map((block, index) => {
              if (block.kind === "p") {
                return (
                  <p key={index} className="text-sm text-ink">
                    {block.text}
                  </p>
                );
              }
              if (block.kind === "note") {
                return (
                  <p key={index} className="text-sm text-muted">
                    {block.text}
                  </p>
                );
              }
              if (block.kind === "kv") {
                return (
                  <dl key={index} className="grid gap-3 sm:grid-cols-2">
                    {block.rows.map((row) => (
                      <div key={row.k}>
                        <dt className="text-xs font-medium text-muted">{row.k}</dt>
                        <dd className="mt-1 text-sm text-ink">{row.v}</dd>
                      </div>
                    ))}
                  </dl>
                );
              }
              return <DataTable key={index} columns={block.columns} rows={block.rows} caption={block.caption} />;
            })}
          </div>
        </section>
      ))}
    </article>
  );
}
