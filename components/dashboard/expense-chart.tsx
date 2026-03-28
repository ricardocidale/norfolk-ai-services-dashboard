"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { name: string; total: number; count: number };

export function ExpenseChart({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No expenses yet. Add rows or run a sync to populate the chart.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            interval={0}
            angle={-28}
            textAnchor="end"
            height={72}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
            stroke="var(--border)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--popover-foreground)",
            }}
            formatter={(value: number) => [`$${Number(value).toFixed(2)}`, "Total"]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as Row | undefined;
              return row ? `${row.name} (${row.count} items)` : "";
            }}
          />
          <Bar
            dataKey="total"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
