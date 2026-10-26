import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function buttonClass(variant: "primary" | "secondary" | "quiet" = "primary") {
  const base =
    "btn inline-flex h-11 items-center justify-center rounded-sm px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
  if (variant === "secondary") return cn(base, "border border-line bg-cream text-ink hover:bg-sand");
  if (variant === "quiet") return cn(base, "bg-transparent px-2 text-ink underline-offset-4 hover:underline");
  return cn(base, "bg-accent text-on-accent hover:bg-ink");
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" }) {
  return <button type={type} className={cn(buttonClass(variant), className)} {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

const fieldClass =
  "w-full rounded-sm border border-line bg-cream px-3 text-sm text-ink tabular-nums placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, "h-11", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldClass, "min-h-28 py-3", props.className)} />;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-line bg-cream p-4", className)}>{children}</section>;
}

export function Badge({ tone, children }: { tone: "neutral" | "ok" | "warn" | "bad"; children: ReactNode }) {
  const toneClass = {
    neutral: "bg-sand text-ink",
    ok: "bg-ok-bg text-ok",
    warn: "bg-warn-bg text-warn",
    bad: "bg-bad-bg text-bad",
  }[tone];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", toneClass)}>
      {children}
    </span>
  );
}

export function DataTable({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: string[][];
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm tabular-nums">
        {caption ? <caption className="pb-3 text-left text-muted">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line text-muted">
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-2 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-b border-line align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
