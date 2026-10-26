import { useEffect, useState, type ComponentType } from "react";

export type ChartRow = { label: string; af: number };

export function MonthChart({ data }: { data: ChartRow[] }) {
  const [Inner, setInner] = useState<ComponentType<{ data: ChartRow[] }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./month-chart-inner").then((mod) => {
      if (!cancelled) setInner(() => mod.MonthChartInner);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Inner) return <div className="h-56 rounded-xl border border-line bg-cream" aria-hidden="true" />;
  return <Inner data={data} />;
}
