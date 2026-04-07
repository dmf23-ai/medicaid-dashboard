"use client";

import { ArrowUp, ArrowDown, Star } from "lucide-react";
import { StateSummary } from "@/lib/types";

interface ComparisonTableProps {
  data: StateSummary[];
  anchorState?: string;
}

export default function ComparisonTable({
  data,
  anchorState = "TX",
}: ComparisonTableProps) {
  const formatNumber = (n: number) => n.toLocaleString();
  const formatCurrency = (n: number) => `$${n.toLocaleString()}`;

  const getRankBadge = (stateCode: string, metric: keyof StateSummary, rows: StateSummary[], higherIsBetter: boolean) => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[metric] as number;
      const bVal = b[metric] as number;
      return higherIsBetter ? bVal - aVal : aVal - bVal;
    });
    const rank = sorted.findIndex((s) => s.stateCode === stateCode) + 1;
    if (rank <= 3) {
      return (
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-semibold">
          #{rank}
        </span>
      );
    }
    if (rank >= rows.length - 1) {
      return (
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded-full font-semibold">
          #{rank}
        </span>
      );
    }
    return null;
  };

  const getExpansionBadge = (status: string) => {
    const colors = {
      expanded: "bg-emerald-50 text-emerald-700",
      not_expanded: "bg-amber-50 text-amber-700",
      partial: "bg-blue-50 text-blue-700",
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">
          State Comparison
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Key metrics across selected states
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                State
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Enrollment
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                YoY Change
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Per Enrollee
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Managed Care
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Quality Score
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Expansion
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((state) => (
              <tr
                key={state.stateCode}
                className={`hover:bg-slate-50 transition-colors ${
                  state.stateCode === anchorState
                    ? "bg-orange-50/50"
                    : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {state.stateCode === anchorState && (
                      <Star className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                    )}
                    <span className="font-semibold text-slate-900">
                      {state.stateCode}
                    </span>
                    <span className="text-slate-500">{state.stateName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {formatNumber(state.enrollment)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      state.enrollmentChange > 0
                        ? "text-emerald-600"
                        : "text-red-600"
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
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {formatCurrency(state.perEnrolleeSpending)}
                  {getRankBadge(state.stateCode, "perEnrolleeSpending", data, false)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {state.managedCarePenetration}%
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-slate-100 rounded-full h-2">
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
                    <span className="font-medium text-slate-900 w-6 text-right">
                      {state.qualityScore}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {getExpansionBadge(state.expansionStatus)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
