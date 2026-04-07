"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  /** When true, positive change = bad (red), negative = good (green). Use for cost metrics. */
  invertTrend?: boolean;
}

export default function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  highlight = false,
  invertTrend = false,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (change === undefined) return null;
    if (change > 0) return <TrendingUp className="w-4 h-4" />;
    if (change < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (change === undefined) return "";
    const isPositiveGood = !invertTrend;
    if (change > 0) return isPositiveGood ? "text-emerald-600" : "text-red-600";
    if (change < 0) return isPositiveGood ? "text-red-600" : "text-emerald-600";
    return "text-slate-500";
  };

  return (
    <div
      className={`bg-white rounded-xl border p-5 ${
        highlight
          ? "border-blue-200 ring-1 ring-blue-100"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 bg-slate-50 rounded-lg text-slate-400">
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-sm font-medium ${getTrendColor()}`}>
          {getTrendIcon()}
          <span>{change > 0 ? "+" : ""}{change}%</span>
          {changeLabel && (
            <span className="text-slate-400 font-normal ml-1">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
