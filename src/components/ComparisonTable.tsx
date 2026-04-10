"use client";

import { ArrowUp, ArrowDown, Star, ChevronRight } from "lucide-react";
import { StateSummary } from "@/lib/types";
import { Tooltip as TooltipHint } from "./Tooltip";
import { SourceLink } from "./SourceLink";

interface ComparisonTableProps {
  data: StateSummary[];
  anchorState?: string;
  onStateClick?: (stateCode: string) => void;
}

export default function ComparisonTable({
  data,
  anchorState = "TX",
  onStateClick,
}: ComparisonTableProps) {
  const formatNumber = (n: number) => n.toLocaleString();
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;

  // Calculate peer medians (excluding anchor state for peer comparison)
  const peerStates = data.filter((s) => s.stateCode !== anchorState);
  const calculateMedian = (metric: keyof StateSummary): number => {
    const values = peerStates
      .map((s) => s[metric] as number)
      .filter((v) => typeof v === "number")
      .sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 !== 0
      ? values[mid]
      : (values[mid - 1] + values[mid]) / 2;
  };

  const enrollmentMedian = calculateMedian("enrollment");
  const perEnrolleeMedian = calculateMedian("perEnrolleeSpending");
  const managedCareMedian = calculateMedian("managedCarePenetration");
  const qualityScoreMedian = calculateMedian("qualityScore");

  const getRankBadge = (stateCode: string, metric: keyof StateSummary, rows: StateSummary[], higherIsBetter: boolean) => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[metric] as number;
      const bVal = b[metric] as number;
      return higherIsBetter ? bVal - aVal : aVal - bVal;
    });
    const rank = sorted.findIndex((s) => s.stateCode === stateCode) + 1;
    if (rank <= 3) {
      return (
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-emerald-900/40 text-emerald-400 rounded-full font-semibold">
          #{rank}
        </span>
      );
    }
    if (rank >= rows.length - 1) {
      return (
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-red-900/40 text-red-400 rounded-full font-semibold">
          #{rank}
        </span>
      );
    }
    return null;
  };

  const getExpansionBadge = (status: string) => {
    const colors = {
      expanded: "bg-emerald-900/30 text-emerald-400",
      not_expanded: "bg-amber-900/30 text-amber-400",
      partial: "bg-blue-900/30 text-blue-400",
    };
    const labels = {
      expanded: "Expanded",
      not_expanded: "Not Expanded",
      partial: "Partial",
    };
    return (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          colors[status as keyof typeof colors] || ""
        }`}
      >
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getPeerIndicator = (value: number, median: number, higherIsBetter: boolean) => {
    if (value > median) {
      return higherIsBetter ? (
        <ArrowUp className="w-3 h-3 text-emerald-400 inline-block ml-1" />
      ) : (
        <ArrowDown className="w-3 h-3 text-amber-400 inline-block ml-1" />
      );
    } else if (value < median) {
      return higherIsBetter ? (
        <ArrowDown className="w-3 h-3 text-amber-400 inline-block ml-1" />
      ) : (
        <ArrowUp className="w-3 h-3 text-emerald-400 inline-block ml-1" />
      );
    }
    return null;
  };

  return (
    <div className="bg-[#111827] rounded-xl border border-[#1E293B] overflow-hidden">
      <div className="p-5 border-b border-[#1E293B] bg-[#0B1120]">
        <h3 className="text-sm font-semibold text-[#F1F5F9]">
          State Benchmarking
        </h3>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          Texas vs. selected peers with median comparison
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0B1120] text-left">
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                State
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">
                <TooltipHint content="Total Medicaid and CHIP beneficiaries enrolled at period end">
                  <span className="border-b border-dashed border-[#64748B] cursor-help">Enrollment</span>
                </TooltipHint>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">
                <TooltipHint content="Year-over-year enrollment change as a percentage">
                  <span className="border-b border-dashed border-[#64748B] cursor-help">YoY Change</span>
                </TooltipHint>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">
                <TooltipHint content="Annual Medicaid spending per enrolled beneficiary (federal + state)">
                  <span className="border-b border-dashed border-[#64748B] cursor-help">Per Enrollee</span>
                </TooltipHint>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">
                <TooltipHint content="Percentage of beneficiaries enrolled in managed care organizations">
                  <span className="border-b border-dashed border-[#64748B] cursor-help">Managed Care</span>
                </TooltipHint>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-right">
                <TooltipHint content="Composite quality score based on CMS Core Set measures (0-100 scale)">
                  <span className="border-b border-dashed border-[#64748B] cursor-help">Quality Score</span>
                </TooltipHint>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                <TooltipHint content="Whether the state has expanded Medicaid under the ACA">
                  <span className="border-b border-dashed border-[#64748B] cursor-help">Expansion</span>
                </TooltipHint>
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {data.map((state) => (
              <tr
                key={state.stateCode}
                onClick={() => onStateClick?.(state.stateCode)}
                className={`transition-colors ${
                  state.stateCode === anchorState
                    ? "bg-[#F97316]/5 hover:bg-[#F97316]/10"
                    : "hover:bg-[#1E293B]/50"
                } ${onStateClick ? "cursor-pointer" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {state.stateCode === anchorState && (
                      <Star className="w-3.5 h-3.5 fill-[#F97316] text-[#F97316]" />
                    )}
                    <span className="font-semibold text-[#F1F5F9]">
                      {state.stateCode}
                    </span>
                    <span className="text-[#94A3B8]">{state.stateName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-[#F1F5F9]">
                  {formatNumber(state.enrollment)}
                  {state.stateCode === anchorState &&
                    getPeerIndicator(state.enrollment, enrollmentMedian, true)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      state.enrollmentChange > 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {state.enrollmentChange > 0 ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    )}
                    {Math.abs(state.enrollmentChange)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-[#F1F5F9]">
                  {formatCurrency(state.perEnrolleeSpending)}
                  {state.stateCode === anchorState &&
                    getPeerIndicator(
                      state.perEnrolleeSpending,
                      perEnrolleeMedian,
                      false
                    )}
                  {getRankBadge(state.stateCode, "perEnrolleeSpending", data, false)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-[#F1F5F9]">
                  {state.managedCarePenetration}%
                  {state.stateCode === anchorState &&
                    getPeerIndicator(
                      state.managedCarePenetration,
                      managedCareMedian,
                      true
                    )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-[#1E293B] rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          state.qualityScore >= 70
                            ? "bg-emerald-500"
                            : state.qualityScore >= 55
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${state.qualityScore}%` }}
                      />
                    </div>
                    <span className="font-medium text-[#F1F5F9] w-6 text-right">
                      {state.qualityScore}
                    </span>
                    {state.stateCode === anchorState &&
                      getPeerIndicator(
                        state.qualityScore,
                        qualityScoreMedian,
                        true
                      )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {getExpansionBadge(state.expansionStatus)}
                </td>
                <td className="px-4 py-3 text-center">
                  {onStateClick && (
                    <ChevronRight className="w-4 h-4 text-[#64748B] inline-block" />
                  )}
                </td>
              </tr>
            ))}
            {/* Peer Median Row */}
            <tr className="border-t-2 border-dashed border-[#1E293B] bg-[#0B1120]/50">
              <td className="px-4 py-3">
                <span className="italic text-[#94A3B8] text-sm">Peer Median</span>
              </td>
              <td className="px-4 py-3 text-right font-medium text-[#94A3B8] italic">
                {formatNumber(enrollmentMedian)}
              </td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right font-medium text-[#94A3B8] italic">
                {formatCurrency(perEnrolleeMedian)}
              </td>
              <td className="px-4 py-3 text-right font-medium text-[#94A3B8] italic">
                {managedCareMedian.toFixed(1)}%
              </td>
              <td className="px-4 py-3 text-right font-medium text-[#94A3B8] italic">
                {qualityScoreMedian.toFixed(1)}
              </td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-[#1E293B] bg-[#0B1120]">
        <p className="text-[11px] text-[#64748B] leading-relaxed">
          Comparisons across expansion/non-expansion states require careful
          interpretation. Structural differences in eligibility rules and
          demographics affect all metrics.
        </p>
        <SourceLink label="CMS/Medicaid.gov & KFF State Health Facts" url="https://data.medicaid.gov" />
      </div>
    </div>
  );
}
