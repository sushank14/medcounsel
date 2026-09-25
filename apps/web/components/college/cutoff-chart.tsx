"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartPoint {
  year: number;
  round: string;
  closingRank: number;
  specialty: string;
}

export function CutoffChart({ data }: { data: ChartPoint[] }) {
  const grouped = data.reduce(
    (acc, d) => {
      const key = `${d.year}-${d.round}`;
      if (!acc[key]) acc[key] = { label: `${d.year} ${d.round}`, closingRank: d.closingRank };
      return acc;
    },
    {} as Record<string, { label: string; closingRank: number }>
  );

  const chartData = Object.values(grouped);

  if (chartData.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} reversed />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="closingRank"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Closing Rank"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">Lower rank = more competitive. Historical data only — not a future guarantee.</p>
    </div>
  );
}
