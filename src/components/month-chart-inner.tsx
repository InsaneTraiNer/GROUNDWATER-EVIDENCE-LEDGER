import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartRow } from "@/components/month-chart";

export function MonthChartInner({ data }: { data: ChartRow[] }) {
  return (
    <div className="h-56" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ fill: "var(--color-sand)" }}
            formatter={(value) => [`${Number(value).toFixed(2)} AF`, "Ledger"]}
            contentStyle={{
              background: "var(--color-cream)",
              border: "1px solid var(--color-line)",
              borderRadius: 8,
              color: "var(--color-ink)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="af" fill="var(--color-accent)" maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
