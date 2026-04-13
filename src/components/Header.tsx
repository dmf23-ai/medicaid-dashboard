"use client";

import { useState, useEffect } from "react";
import { Activity, Database, Brain } from "lucide-react";
import { Tooltip } from "./Tooltip";

interface HeaderProps {
  dataSource?: "pipeline" | "sample";
  lastUpdated?: string;
  stateCount?: number;
}

export default function Header({
  dataSource = "sample",
  lastUpdated,
  stateCount,
}: HeaderProps) {
  const isLive = dataSource === "pipeline";
  const badgeLabel = isLive ? "Live Data" : "Sample Data";
  const badgeTooltip = isLive
    ? "Pipeline data loaded from CMS sources (enrollment, expenditure, quality)."
    : "Currently showing sample demonstration data. The CMS data pipeline has not been run yet — once the Python agents run, this badge will turn green.";
  const dotColor = isLive ? "bg-emerald-500" : "bg-slate-500";
  const textColor = isLive ? "text-emerald-500" : "text-slate-400";
  const borderColor = isLive ? "border-emerald-500" : "border-slate-500";

  const [updatedLabel, setUpdatedLabel] = useState("—");
  useEffect(() => {
    if (lastUpdated) {
      setUpdatedLabel(
        new Date(lastUpdated).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
      );
    } else {
      setUpdatedLabel("Mar 2026");
    }
  }, [lastUpdated]);

  const stateLabel = stateCount ? `${stateCount} states` : "50 states";

  return (
    <header className="bg-[#060A13] border-b border-[#1E293B] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-[#F97316] rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#F1F5F9] leading-tight">
                National Medicaid Intelligence
              </h1>
              <p className="text-xs text-[#94A3B8] leading-tight">
                Texas Executive Command Surface
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden md:flex items-center gap-2 text-xs text-[#64748B]">
              <Database className="w-3.5 h-3.5" />
              <span>{stateLabel}</span>
              <span className="text-[#2A3547]">|</span>
              <span>Last updated: {updatedLabel}</span>
            </div>
            <Tooltip content={badgeTooltip}>
              <div
                className={`flex items-center gap-2 text-xs ${textColor} font-medium border-b border-dashed ${borderColor}`}
              >
                <div className={`w-2 h-2 ${dotColor} rounded-full ${isLive ? "live-dot" : ""}`} />
                <span className="hidden sm:inline">{badgeLabel}</span>
              </div>
            </Tooltip>
            <Tooltip content="Dashboard analysis is augmented by Claude AI for insight ranking, anomaly detection, and executive briefings">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E293B] text-[#A78BFA] rounded-full text-xs font-medium border border-dashed border-[#A78BFA]">
                <Brain className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI-Powered</span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
}
