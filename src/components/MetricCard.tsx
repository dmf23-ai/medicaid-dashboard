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
    if (change > 0) return isPositiveGood ? "text-emerald-400" : "text-red-400";
    if (change < 0) return isPositiveGood ? "text-red-400" : "text-emerald-400";
    return "text-[#64748B]";
  };

  return (
    <div
      className={`bg-[#111827] rounded-xl border p-5 transition-colors hover:border-[#2A3547] ${
        highlight
          ? "border-[#F97316]/30 ring-1 ring-[#F97316]/10 glow-texas"
          : "border-[#1E293B]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#94A3B8] font-medium">{title}</p>
          <p className="text-2xl font-bold text-[#F1F5F9] mt-1">{value}</p>
        </div>
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 bg-[#1E293B] rounded-lg text-[#64748B]">
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-3 text-sm font-medium ${getTrendColor()}`}>
          {getTrendIcon()}
          <span>{change > 0 ? "+" : ""}{change}%</span>
          {changeLabel && (
            <span className="text-[#475569] font-normal ml-1">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
