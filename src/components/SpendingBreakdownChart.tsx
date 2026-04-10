"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { DollarSign } from "lucide-react";
import { sampleSpendingCategories } from "@/lib/sample-data";
import TooltipWrapper from "./Tooltip";
import SourceLink from "./SourceLink";

const COLORS = [
  "#F97316", // texas orange
  "#60A5FA", // blue
  "#34D399", // emerald
  "#A78BFA", // purple
  "#F472B6", // pink
  "#FBBF24", // amber
];

interface SpendingCategory {
  category: string;
  amount: number;
  percentOfTotal: number;
}

export default function SpendingBreakdownChart() {
  // Transform data to add formatted display fields
  const chartData: (SpendingCategory & {
    displayLabel: string;
    displayValue: string;
  })[] = sampleSpendingCategories.map((item) => ({
    ...item,
    displayLabel: `${item.category}`,
    displayValue: `$${item.amount.toLocaleString()} (${item.percentOfTotal}%)`,
  }));

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="w-5 h-5 text-[#F97316]" />
        <h2 className="text-xl font-semibold text-[#F1F5F9]">
          Per-Enrollee Spending Breakdown
        </h2>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-[#94A3B8] mb-6">
        Texas FY2025 — $7,450 per enrollee
      </p>

      {/* Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 250, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1E293B"
              horizontal={true}
              vertical={false}
            />
            <XAxis
              type="number"
              stroke="#64748B"
              fontSize={12}
              tickFormatter={(value) => `$${value}`}
            />
            <YAxis
              dataKey="category"
              type="category"
              width={240}
              stroke="#64748B"
              fontSize={12}
              tick={{ fill: "#64748B" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1E293B",
                border: "1px solid #2A3547",
                borderRadius: "6px",
              }}
              labelStyle={{ color: "#F1F5F9" }}
              formatter={(value, name) => {
                const n = typeof value === "number" ? value : Number(value);
                if (name === "amount") {
                  return [`$${n.toLocaleString()}`, "Amount"];
                }
                if (name === "percentOfTotal") {
                  return [`${n}%`, "Percent"];
                }
                return [String(value), String(name)];
              }}
              cursor={{ fill: "rgba(249, 115, 22, 0.1)" }}
            />
            <Bar dataKey="amount" fill="#F97316" radius={[0, 8, 8, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Source Link */}
      <SourceLink
        label="CMS MBES/CBES (CMS-64)"
        url="https://www.medicaid.gov/medicaid/financial-management"
      />
    </div>
  );
}
