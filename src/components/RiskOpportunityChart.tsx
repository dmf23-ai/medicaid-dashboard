"use client";

import React, { useState, useMemo } from "react";
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
  ReferenceArea,
  Label,
} from "recharts";
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { sampleRiskOpportunity } from "@/lib/sample-data";
import { RiskOpportunityItem } from "@/lib/types";
import { Tooltip as TooltipHint } from "./Tooltip";
import { SourceLink } from "./SourceLink";

// Color mapping for trends
const trendColors: Record<string, string> = {
  improving: "#10B981", // emerald
  stable: "#F59E0B", // amber
  deteriorating: "#EF4444", // red
};

const trendLabels: Record<string, string> = {
  improving: "Improving",
  stable: "Stable",
  deteriorating: "Deteriorating",
};

// Quadrant metadata
type QuadrantKey = "backburner" | "pursue" | "defend" | "executive";

const quadrantMeta: Record<
  QuadrantKey,
  { label: string; description: string; tint: string; stroke: string }
> = {
  backburner: {
    label: "Backburner",
    description: "Low stakes. Monitor, don't invest capacity.",
    tint: "#1E293B",
    stroke: "#334155",
  },
  pursue: {
    label: "Pursue",
    description: "High upside, manageable risk. Capture-team territory.",
    tint: "#064E3B",
    stroke: "#10B981",
  },
  defend: {
    label: "Defend",
    description: "High risk, low upside. Protect the book of business.",
    tint: "#7F1D1D",
    stroke: "#EF4444",
  },
  executive: {
    label: "Executive Priority",
    description: "Both high risk and high upside. Requires the Chief's attention.",
    tint: "#78350F",
    stroke: "#F97316",
  },
};

const getQuadrant = (item: RiskOpportunityItem): QuadrantKey => {
  const highRisk = item.risk >= 50;
  const highOpp = item.opportunity >= 50;
  if (highRisk && highOpp) return "executive";
  if (!highRisk && highOpp) return "pursue";
  if (highRisk && !highOpp) return "defend";
  return "backburner";
};

// Priority score used for numbering and ranking list
const priorityScore = (item: RiskOpportunityItem): number => {
  // Heavier weight on opportunity + impact, but risk also elevates salience
  return item.impact * 0.5 + item.opportunity * 0.35 + item.risk * 0.15;
};

const trendIcon = (trend: string, className = "w-3.5 h-3.5") => {
  if (trend === "improving") return <TrendingUp className={className} />;
  if (trend === "deteriorating") return <TrendingDown className={className} />;
  return <Minus className={className} />;
};

// Custom tooltip component for chart
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: RiskOpportunityItem & { rank: number } }> }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="rounded border border-[#2A3547] bg-[#0B1120] p-3 text-sm text-white shadow-lg max-w-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1E293B] border border-[#2A3547] text-xs font-bold text-white">
          {data.rank}
        </span>
        <p className="font-semibold text-white">{data.label}</p>
      </div>
      <p className="text-xs text-gray-400 mb-2">{data.description}</p>
      <div className="space-y-1 text-xs">
        <p>Risk: {data.risk}</p>
        <p>Opportunity: {data.opportunity}</p>
        <p>Impact: {data.impact}</p>
        <p className="capitalize">Trend: {data.trend}</p>
      </div>
    </div>
  );
};

export default function RiskOpportunityChart() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Rank items by priority score (descending) and attach rank number
  const rankedItems = useMemo(() => {
    const sorted = [...sampleRiskOpportunity].sort(
      (a, b) => priorityScore(b) - priorityScore(a)
    );
    return sorted.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, []);

  // Count items per quadrant
  const quadrantCounts = useMemo(() => {
    const counts: Record<QuadrantKey, number> = {
      backburner: 0,
      pursue: 0,
      defend: 0,
      executive: 0,
    };
    for (const item of rankedItems) counts[getQuadrant(item)]++;
    return counts;
  }, [rankedItems]);

  const selectedItem = selectedId
    ? rankedItems.find((i) => i.id === selectedId)
    : null;

  // Custom shape draws bubble with rank number inside.
  // Typed as `any` because Recharts' ScatterShapeProps does not carry through
  // our payload generic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderBubble = (props: any) => {
    const { cx, cy, fill, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return <g />;
    // Radius derived directly from payload.impact so bubble size tracks
    // impact 40 → r=12, impact 100 → r=32 (linear), with safety clamp.
    const impactRaw = payload.impact;
    const impact =
      typeof impactRaw === "number" && Number.isFinite(impactRaw)
        ? impactRaw
        : 50;
    const radius = Math.max(10, Math.min(34, 12 + ((impact - 40) / 60) * 20));
    const isSelected = selectedId === payload.id;
    return (
      <g
        style={{ cursor: "pointer" }}
        onClick={() => setSelectedId(payload.id === selectedId ? null : payload.id)}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fill}
          fillOpacity={isSelected ? 0.95 : 0.78}
          stroke={isSelected ? "#F1F5F9" : "#0B1120"}
          strokeWidth={isSelected ? 2.5 : 1.5}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={700}
          fill="#0B1120"
          pointerEvents="none"
        >
          {payload.rank}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6 rounded-lg border border-[#1E293B] bg-[#111827] p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Crosshair className="h-5 w-5 text-blue-400" />
        <TooltipHint content="Risk-opportunity assessment of key Medicaid developments. Bubble size = potential impact. Color = trend direction. Number = priority rank. Click a bubble or list item for detail.">
          <h2 className="text-xl font-semibold text-white border-b border-dashed border-[#475569]">
            Risk & Opportunity Matrix
          </h2>
        </TooltipHint>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart column (spans 2) */}
        <div className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={440}>
            <ScatterChart margin={{ top: 30, right: 30, bottom: 40, left: 30 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1E293B"
                vertical={true}
                horizontal={true}
              />

              {/* Quadrant background tints */}
              <ReferenceArea
                x1={0}
                x2={50}
                y1={0}
                y2={50}
                fill={quadrantMeta.backburner.tint}
                fillOpacity={0.25}
                stroke="none"
                ifOverflow="hidden"
              />
              <ReferenceArea
                x1={0}
                x2={50}
                y1={50}
                y2={100}
                fill={quadrantMeta.pursue.tint}
                fillOpacity={0.35}
                stroke="none"
                ifOverflow="hidden"
              />
              <ReferenceArea
                x1={50}
                x2={100}
                y1={0}
                y2={50}
                fill={quadrantMeta.defend.tint}
                fillOpacity={0.3}
                stroke="none"
                ifOverflow="hidden"
              />
              <ReferenceArea
                x1={50}
                x2={100}
                y1={50}
                y2={100}
                fill={quadrantMeta.executive.tint}
                fillOpacity={0.4}
                stroke="none"
                ifOverflow="hidden"
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
                  value="Delivery / Regulatory Risk →"
                  position="insideBottom"
                  offset={-15}
                  fill="#94A3B8"
                  fontSize={12}
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
                  value="Strategic Upside →"
                  angle={-90}
                  position="insideLeft"
                  offset={10}
                  fill="#94A3B8"
                  fontSize={12}
                />
              </YAxis>

              {/* Z-axis: Impact for bubble size */}
              <ZAxis dataKey="impact" range={[400, 2400]} name="Impact" />

              {/* Dividing reference lines at 50/50 */}
              <ReferenceLine x={50} stroke="#475569" strokeDasharray="4 4" />
              <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" />

              {/* Quadrant labels with counts */}
              <text x="13%" y="10%" fontSize={11} fontWeight={600} fill="#10B981" opacity={0.9} textAnchor="middle">
                Pursue ({quadrantCounts.pursue})
              </text>
              <text x="87%" y="10%" fontSize={11} fontWeight={600} fill="#F97316" opacity={0.9} textAnchor="middle">
                Executive Priority ({quadrantCounts.executive})
              </text>
              <text x="13%" y="94%" fontSize={11} fontWeight={600} fill="#64748B" opacity={0.9} textAnchor="middle">
                Backburner ({quadrantCounts.backburner})
              </text>
              <text x="87%" y="94%" fontSize={11} fontWeight={600} fill="#EF4444" opacity={0.9} textAnchor="middle">
                Defend ({quadrantCounts.defend})
              </text>

              <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />

              <Scatter
                name="Risk vs Opportunity"
                data={rankedItems}
                shape={renderBubble}
              >
                {rankedItems.map((item) => (
                  <Cell key={item.id} fill={trendColors[item.trend]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#10B981]" />
              <span className="text-xs text-gray-300">Improving</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#F59E0B]" />
              <span className="text-xs text-gray-300">Stable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#EF4444]" />
              <span className="text-xs text-gray-300">Deteriorating</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="inline-block h-3 w-3 rounded-full border border-gray-400" />
              <span>Size = Impact</span>
            </div>
          </div>
        </div>

        {/* Ranked list column */}
        <div className="lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Ranked by Priority
            </h3>
          </div>
          <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
            {rankedItems.map((item) => {
              const quadrant = getQuadrant(item);
              const qMeta = quadrantMeta[quadrant];
              const isSelected = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : item.id)}
                  className={`w-full text-left rounded-md p-2.5 border transition-colors ${
                    isSelected
                      ? "bg-slate-800 border-slate-500"
                      : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-slate-900"
                      style={{ backgroundColor: trendColors[item.trend] }}
                    >
                      {item.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-slate-100 truncate">
                          {item.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: qMeta.stroke }}
                        >
                          {qMeta.label}
                        </span>
                        <span className="text-[10px] text-slate-500">•</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          {trendIcon(item.trend, "w-3 h-3")}
                          {trendLabels[item.trend]}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected item detail card */}
      {selectedItem && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 animate-fade-in">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-slate-900"
                style={{ backgroundColor: trendColors[selectedItem.trend] }}
              >
                {selectedItem.rank}
              </span>
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-slate-100">
                  {selectedItem.label}
                </h4>
                <p className="text-sm text-slate-400 mt-0.5">
                  {selectedItem.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
              aria-label="Close detail"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="rounded bg-slate-800/60 border border-slate-700 p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Risk</p>
              <p className="text-lg font-bold text-slate-100">{selectedItem.risk}</p>
            </div>
            <div className="rounded bg-slate-800/60 border border-slate-700 p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Opportunity</p>
              <p className="text-lg font-bold text-slate-100">{selectedItem.opportunity}</p>
            </div>
            <div className="rounded bg-slate-800/60 border border-slate-700 p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Impact</p>
              <p className="text-lg font-bold text-slate-100">{selectedItem.impact}</p>
            </div>
            <div className="rounded bg-slate-800/60 border border-slate-700 p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Trend</p>
              <p className="text-sm font-semibold capitalize flex items-center gap-1 text-slate-100">
                {trendIcon(selectedItem.trend, "w-3.5 h-3.5")}
                {selectedItem.trend}
              </p>
            </div>
          </div>

          {selectedItem.recommendedAction && (
            <div className="rounded-md bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-600 p-3 mb-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
                Recommended Action
              </p>
              <p className="text-sm text-slate-200 font-medium flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{selectedItem.recommendedAction}</span>
              </p>
            </div>
          )}

          {selectedItem.sourceUrl && (
            <a
              href={selectedItem.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#F97316] hover:text-orange-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View source
            </a>
          )}
        </div>
      )}

      <SourceLink
        label="Accenture Intelligence Analysis"
        url="/methodology#risk-opportunity"
        date="Mar 2026"
      />
    </div>
  );
}
