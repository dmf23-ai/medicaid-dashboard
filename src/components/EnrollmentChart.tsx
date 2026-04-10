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
import { Tooltip as TooltipHint } from "./Tooltip";
import { SourceLink } from "./SourceLink";

interface EnrollmentChartProps {
  states: string[];
  anchorState?: string;
}

export default function EnrollmentChart({
  states,
  anchorState = "TX",
}: EnrollmentChartProps) {
  const allStates = [anchorState, ...states.filter((s) => s !== anchorState)];

  // Build unified dataset: each row has month + value per state
  const months = sampleEnrollmentTrends[anchorState]?.map((d) => d.month) || [];
  const chartData = months.map((month) => {
    const row: Record<string, string | number> = { month };
    allStates.forEach((code) => {
      const trend = sampleEnrollmentTrends[code];
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
    <div className="bg-[#111827] rounded-xl border border-[#1E293B] p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <TooltipHint content="Monthly enrollment headcount for Texas and selected comparison states. Dashed lines indicate non-anchor states.">
            <h3 className="text-sm font-semibold text-[#F1F5F9] border-b border-dashed border-[#475569]">
              Texas vs. Peer States: Enrollment
            </h3>
          </TooltipHint>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Monthly Medicaid &amp; CHIP enrollment by state
          </p>
        </div>
        <span className="text-xs text-[#475569]">2025</span>
      </div>

      <div className="flex-1 min-h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={{ stroke: "#1E293B" }}
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={{ stroke: "#1E293B" }}
            width={55}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              formatValue(Number(value)),
              String(name),
            ]}
            labelFormatter={(label: unknown) => formatMonth(String(label))}
            contentStyle={{
              background: "#1E293B",
              border: "1px solid #2A3547",
              color: "#F1F5F9",
              borderRadius: "8px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              fontSize: "12px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px", color: "#94A3B8" }}
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
      <SourceLink label="CMS Monthly Medicaid & CHIP Enrollment" url="https://data.medicaid.gov/dataset/6165f45b-ca93-5bb5-9d06-db29c692a360" />
    </div>
  );
}
