"use client";

import { useState, useEffect } from "react";
import {
  X,
  Users,
  DollarSign,
  Shield,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { StateSummary } from "@/lib/types";
import { sampleSignals, sampleAlerts } from "@/lib/sample-data";
import { US_STATES } from "@/lib/constants";

interface StateDetailPanelProps {
  stateCode: string | null;
  onClose: () => void;
  states: StateSummary[];
  trends: Record<string, { month: string; value: number }[]>;
}

export default function StateDetailPanel({
  stateCode,
  onClose,
  states,
  trends,
}: StateDetailPanelProps) {
  if (!stateCode) return null;

  const state = states.find((s) => s.stateCode === stateCode);
  if (!state) return null;

  const stateName = US_STATES[stateCode]?.name || state.stateName;
  const trendData = trends[stateCode] || [];

  // Filter for last 6 months
  const last6Months = trendData.slice(-6);

  // Get related signals
  const relatedSignals = sampleSignals.filter(
    (signal) => signal.affectedStates?.includes(stateCode)
  );

  // Get related alerts
  const relatedAlerts = sampleAlerts.filter(
    (alert) => alert.stateCode === stateCode
  );

  // Get peer states for comparison (all except current)
  const peerStates = states.filter((s) => s.stateCode !== stateCode);

  // Calculate rank and relative position for each metric
  const getMetricRank = (
    metric: keyof StateSummary,
    higherIsBetter: boolean
  ) => {
    const sorted = [...states].sort((a, b) => {
      const aVal = a[metric] as number;
      const bVal = b[metric] as number;
      return higherIsBetter ? bVal - aVal : aVal - bVal;
    });
    const rank = sorted.findIndex((s) => s.stateCode === stateCode) + 1;
    return { rank, total: sorted.length };
  };

  const categoryColors: Record<string, string> = {
    procurement: "#F97316", // orange
    policy: "#60A5FA", // blue
    regulatory: "#34D399", // emerald
    oig: "#C084FC", // purple
    cms: "#22D3EE", // cyan
    legislative: "#FBBF24", // amber
  };

  const severityColors: Record<string, string> = {
    critical: "#EF4444", // red
    high: "#F97316", // orange
    medium: "#FBBF24", // amber
    low: "#34D399", // emerald
  };

  const formatNumber = (n: number) => n.toLocaleString();
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-[#0B1120] border-l border-[#1E293B] z-50 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0B1120] border-b border-[#1E293B] p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#F1F5F9]">
              {stateName}
            </h2>
            <p className="text-[11px] text-[#94A3B8] mt-1">
              State Code: {stateCode}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#1E293B] rounded transition-colors"
          >
            <X className="w-5 h-5 text-[#94A3B8] hover:text-[#F1F5F9]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* A) Key Metrics Grid (2x2) */}
          <div>
            <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
              Key Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Enrollment */}
              <div className="bg-[#111827] rounded-lg p-3 border border-[#1E293B]">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-[#F97316]" />
                  <p className="text-xs text-[#64748B]">ENROLLMENT</p>
                </div>
                <p className="text-xl font-bold text-[#F1F5F9]">
                  {formatNumber(state.enrollment / 1_000_000).split(".")[0]}M
                </p>
                <p
                  className={`text-xs mt-1 ${
                    state.enrollmentChange < 0
                      ? "text-red-400"
                      : "text-emerald-400"
                  }`}
                >
                  {state.enrollmentChange > 0 ? "+" : ""}
                  {state.enrollmentChange}% YoY
                </p>
              </div>

              {/* Per-Enrollee Spending */}
              <div className="bg-[#111827] rounded-lg p-3 border border-[#1E293B]">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-[#F97316]" />
                  <p className="text-xs text-[#64748B]">PER ENROLLEE</p>
                </div>
                <p className="text-xl font-bold text-[#F1F5F9]">
                  {formatCurrency(state.perEnrolleeSpending)}
                </p>
                <p className="text-xs text-[#94A3B8] mt-1">Annual Spending</p>
              </div>

              {/* Quality Score */}
              <div className="bg-[#111827] rounded-lg p-3 border border-[#1E293B]">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-[#F97316]" />
                  <p className="text-xs text-[#64748B]">QUALITY SCORE</p>
                </div>
                <p className="text-xl font-bold text-[#F1F5F9]">
                  {state.qualityScore}/100
                </p>
                <p
                  className={`text-xs mt-1 ${
                    state.qualityScore >= 70
                      ? "text-emerald-400"
                      : state.qualityScore >= 55
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {state.qualityScore >= 70
                    ? "Above Average"
                    : state.qualityScore >= 55
                    ? "Average"
                    : "Below Average"}
                </p>
              </div>

              {/* Managed Care Rate */}
              <div className="bg-[#111827] rounded-lg p-3 border border-[#1E293B]">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-[#F97316]" />
                  <p className="text-xs text-[#64748B]">MANAGED CARE</p>
                </div>
                <p className="text-xl font-bold text-[#F1F5F9]">
                  {state.managedCarePenetration}%
                </p>
                <p className="text-xs text-[#94A3B8] mt-1">Penetration Rate</p>
              </div>
            </div>
          </div>

          {/* B) 12-Month Enrollment Trend */}
          {trendData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
                12-Month Trend
              </h3>
              <div className="bg-[#111827] rounded-lg p-3 border border-[#1E293B]">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart
                    data={last6Months}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: "#64748B" }}
                      axisLine={{ stroke: "#1E293B" }}
                      tickFormatter={(value) =>
                        value.split("-")[1] === "01"
                          ? "Jan"
                          : value.split("-")[1] === "02"
                          ? "Feb"
                          : value.split("-")[1] === "03"
                          ? "Mar"
                          : value.split("-")[1] === "04"
                          ? "Apr"
                          : value.split("-")[1] === "05"
                          ? "May"
                          : value.split("-")[1] === "06"
                          ? "Jun"
                          : value.split("-")[1] === "07"
                          ? "Jul"
                          : value.split("-")[1] === "08"
                          ? "Aug"
                          : value.split("-")[1] === "09"
                          ? "Sep"
                          : value.split("-")[1] === "10"
                          ? "Oct"
                          : value.split("-")[1] === "11"
                          ? "Nov"
                          : "Dec"
                      }
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748B" }}
                      axisLine={{ stroke: "#1E293B" }}
                      tickFormatter={(value) => `${(value / 1_000_000).toFixed(1)}M`}
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111827",
                        border: "1px solid #1E293B",
                        borderRadius: "4px",
                      }}
                      labelStyle={{ color: "#F1F5F9" }}
                      formatter={(value) => [
                        formatNumber(
                          typeof value === "number" ? value : Number(value)
                        ),
                        "Enrollment",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#F97316"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorArea)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* C) Peer Comparison */}
          {peerStates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
                Peer Comparison
              </h3>
              <div className="space-y-3">
                {/* Enrollment Rank */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#64748B]">ENROLLMENT</span>
                    <span className="text-xs font-semibold text-[#F1F5F9]">
                      Rank {getMetricRank("enrollment", true).rank}/
                      {getMetricRank("enrollment", true).total}
                    </span>
                  </div>
                  <div className="w-full bg-[#1E293B] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#F97316] h-full"
                      style={{
                        width: `${
                          ((getMetricRank("enrollment", true).total -
                            getMetricRank("enrollment", true).rank) /
                            getMetricRank("enrollment", true).total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Per-Enrollee Spending Rank */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#64748B]">PER ENROLLEE</span>
                    <span className="text-xs font-semibold text-[#F1F5F9]">
                      Rank {getMetricRank("perEnrolleeSpending", false).rank}/
                      {getMetricRank("perEnrolleeSpending", false).total}
                    </span>
                  </div>
                  <div className="w-full bg-[#1E293B] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#F97316] h-full"
                      style={{
                        width: `${
                          ((getMetricRank("perEnrolleeSpending", false).total -
                            getMetricRank("perEnrolleeSpending", false).rank) /
                            getMetricRank("perEnrolleeSpending", false).total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Quality Score Rank */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#64748B]">QUALITY</span>
                    <span className="text-xs font-semibold text-[#F1F5F9]">
                      Rank {getMetricRank("qualityScore", true).rank}/
                      {getMetricRank("qualityScore", true).total}
                    </span>
                  </div>
                  <div className="w-full bg-[#1E293B] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#F97316] h-full"
                      style={{
                        width: `${
                          ((getMetricRank("qualityScore", true).total -
                            getMetricRank("qualityScore", true).rank) /
                            getMetricRank("qualityScore", true).total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Managed Care Rank */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#64748B]">MANAGED CARE</span>
                    <span className="text-xs font-semibold text-[#F1F5F9]">
                      Rank{" "}
                      {getMetricRank("managedCarePenetration", true).rank}/
                      {getMetricRank("managedCarePenetration", true).total}
                    </span>
                  </div>
                  <div className="w-full bg-[#1E293B] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#F97316] h-full"
                      style={{
                        width: `${
                          ((getMetricRank("managedCarePenetration", true)
                            .total -
                            getMetricRank("managedCarePenetration", true).rank) /
                            getMetricRank("managedCarePenetration", true)
                              .total) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* D) Related Signals */}
          {relatedSignals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
                Related Signals
              </h3>
              <div className="space-y-2">
                {relatedSignals.slice(0, 3).map((signal) => (
                  <div
                    key={signal.id}
                    className="bg-[#111827] rounded-lg p-3 border border-[#1E293B]"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                        style={{
                          backgroundColor:
                            categoryColors[signal.category] || "#94A3B8",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#F1F5F9] truncate">
                          {signal.title}
                        </p>
                        <p className="text-[10px] text-[#64748B] mt-0.5 line-clamp-2">
                          {signal.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* E) Related Alerts */}
          {relatedAlerts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
                Related Alerts
              </h3>
              <div className="space-y-2">
                {relatedAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-[#111827] rounded-lg p-3 border border-[#1E293B]"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className="w-4 h-4 flex-shrink-0 mt-0.5"
                        style={{
                          color: severityColors[alert.severity] || "#94A3B8",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#F1F5F9] truncate">
                          {alert.title}
                        </p>
                        <p className="text-[10px] text-[#64748B] mt-0.5 line-clamp-2">
                          {alert.description}
                        </p>
                        <p className="text-[9px] text-[#64748B] mt-1">
                          {new Date(alert.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {relatedSignals.length === 0 &&
            relatedAlerts.length === 0 && (
              <div className="bg-[#111827] rounded-lg p-4 border border-[#1E293B] text-center">
                <p className="text-sm text-[#94A3B8]">
                  No signals or alerts for this state at this time.
                </p>
              </div>
            )}
        </div>
      </div>
    </>
  );
}
