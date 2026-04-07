"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { STATE_COLORS } from "@/lib/constants";
import { sampleEnrollmentTrends } from "@/lib/sample-data";

interface EnrollmentChartProps {
  states: string[];
  anchorState?: string;
  trends?: Record<string, { month: string; value: number }[]>;
}

export default function EnrollmentChart({
  states,
  anchorState = "TX",
  trends,
}: EnrollmentChartProps) {
  // Use provided trends (from hook/pipeline) or fall back to sample data
  const trendData = trends && Object.keys(trends).length > 0 ? trends : sampleEnrollmentTrends;

  const allStates = [anchorState, ...states.filter((s) => s !== anchorState)];

  // Build unified dataset: each row has month + value per state
  const months = trendData[anchorState]?.map((d) => d.month) || [];
  const chartData = months.map((month) => {
    const row: Record<string, string | number> = { month };
    allStates.forEach((code) => {
      const trend = trendData[code];
      const point = trend?.find((d) => d.month === month);
      if (point) {
        row[code] = point.value;
      }
    });
    return row;
  });

  const formatMonth = (month: string) => {
    const [year, m] = month.split("-");
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${monthNames[parseInt(m) - 1]} '${year.slice(2)}`;
  };

  const formatValue = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Enrollment Trends
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Monthly Medicaid &amp; CHIP enrollment by state
          </p>
        </div>
        <span className="text-xs text-slate-400">2025</span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            width={55}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              formatValue(Number(value)),
              String(name),
            ]}
            labelFormatter={(label: unknown) => formatMonth(String(label))}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              fontSize: "12px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
          />
          {allStates.map((code) => (
            <Line
              key={code}
              type="monotone"
              dataKey={code}
              stroke={
                STATE_COLORS[code] || STATE_COLORS.DEFAULT
              }
              strokeWidth={code === anchorState ? 3 : 1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
              strokeDasharray={code === anchorState ? undefined : "5 3"}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
