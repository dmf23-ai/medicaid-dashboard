"use client";

import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
  ReferenceLine,
  Label,
} from "recharts";
import { Crosshair } from "lucide-react";
import { sampleRiskOpportunity } from "@/lib/sample-data";
import { RiskOpportunityItem } from "@/lib/types";

// Color mapping for trends
const trendColors: Record<string, string> = {
  improving: "#10B981", // emerald
  stable: "#F59E0B", // amber
  deteriorating: "#EF4444", // red
};

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload as RiskOpportunityItem;

  return (
    <div className="rounded border border-[#2A3547] bg-[#1E293B] p-3 text-sm text-white shadow-lg">
      <p className="font-semibold text-white">{data.label}</p>
      <p className="text-xs text-gray-400">{data.description}</p>
      <div className="mt-2 space-y-1 text-xs">
        <p>Risk: {data.risk}</p>
        <p>Opportunity: {data.opportunity}</p>
        <p>Impact: {data.impact}</p>
        <p className="capitalize">Trend: {data.trend}</p>
        <p className="capitalize">Category: {data.category}</p>
      </div>
    </div>
  );
};

// Quadrant label component
const QuadrantLabel = ({
  x,
  y,
  text,
}: {
  x: number;
  y: number;
  text: string;
}) => (
  <text
    x={x}
    y={y}
    fontSize="12"
    fill="#475569"
    opacity="0.6"
    textAnchor="middle"
    dominantBaseline="middle"
  >
    {text}
  </text>
);

export default function RiskOpportunityChart() {
  return (
    <div className="space-y-6 rounded-lg border border-[#1E293B] bg-[#111827] p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Crosshair className="h-5 w-5 text-blue-400" />
        <h2 className="text-xl font-semibold text-white">
          Risk & Opportunity Matrix
        </h2>
      </div>

      {/* Chart */}
      <div className="w-full">
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart
            margin={{ top: 60, right: 60, bottom: 60, left: 60 }}
            data={sampleRiskOpportunity}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1E293B"
              vertical={true}
              horizontal={true}
            />

            {/* X-axis: Risk */}
            <XAxis
              type="number"
              dataKey="risk"
              name="Risk"
              domain={[0, 100]}
              stroke="#64748B"
              tick={{ fill: "#64748B", fontSize: 12 }}
            >
              <Label
                value="Delivery / Regulatory Risk"
                position="insideBottom"
                offset={-10}
                fill="#64748B"
              />
            </XAxis>

            {/* Y-axis: Opportunity */}
            <YAxis
              type="number"
              dataKey="opportunity"
              name="Opportunity"
              domain={[0, 100]}
              stroke="#64748B"
              tick={{ fill: "#64748B", fontSize: 12 }}
            >
              <Label
                value="Strategic Upside"
                angle={-90}
                position="insideLeft"
                offset={10}
                fill="#64748B"
              />
            </YAxis>

            {/* Z-axis: Impact for bubble size */}
            <ZAxis dataKey="impact" range={[200, 2000]} name="Impact" />

            {/* Reference lines at 50/50 to create quadrants */}
            <ReferenceLine
              x={50}
              stroke="#2A3547"
              strokeDasharray="5 5"
              label={false}
            />
            <ReferenceLine
              y={50}
              stroke="#2A3547"
              strokeDasharray="5 5"
              label={false}
            />

            {/* Quadrant labels */}
            {/* "Monitor" - low risk, low opp (bottom-left) */}
            <text
              x="13%"
              y="18%"
              fontSize="12"
              fill="#475569"
              opacity="0.6"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              Monitor
            </text>

            {/* "Watch & Position" - low risk, high opp (bottom-right) */}
            <text
              x="87%"
              y="18%"
              fontSize="12"
              fill="#475569"
              opacity="0.6"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              Watch & Position
            </text>

            {/* "Protect" - high risk, low opp (top-left) */}
            <text
              x="13%"
              y="82%"
              fontSize="12"
              fill="#475569"
              opacity="0.6"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              Protect
            </text>

            {/* "Executive Focus" - high risk, high opp (top-right) */}
            <text
              x="87%"
              y="82%"
              fontSize="12"
              fill="#475569"
              opacity="0.6"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              Executive Focus
            </text>

            {/* Tooltip */}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />

            {/* Scatter plot with color-coded trends */}
            <Scatter
              name="Risk vs Opportunity"
              data={sampleRiskOpportunity}
              fill="#8884d8"
            >
              {sampleRiskOpportunity.map((item) => (
                <Cell key={item.id} fill={trendColors[item.trend]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-8">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#10B981]" />
          <span className="text-sm text-gray-300">Improving</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#F59E0B]" />
          <span className="text-sm text-gray-300">Stable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
          <span className="text-sm text-gray-300">Deteriorating</span>
        </div>
      </div>
    </div>
  );
}
