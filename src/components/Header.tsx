"use client";

import { Activity, Database, Brain } from "lucide-react";

interface HeaderProps {
  dataSource?: "pipeline" | "sample";
  lastUpdated?: string;
}

export default function Header({ dataSource = "sample", lastUpdated }: HeaderProps) {
  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "—";

  const isLive = dataSource === "pipeline";
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-800 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                National Medicaid Intelligence
              </h1>
              <p className="text-xs text-slate-500 leading-tight">
                Multi-State Comparison Dashboard
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <Database className="w-3.5 h-3.5" />
              <span>50 states</span>
              <span className="text-slate-300">|</span>
              <span>Last updated: {formattedDate}</span>
            </div>
            <div className={`flex items-center gap-2 text-xs font-medium ${isLive ? "text-emerald-600" : "text-amber-600"}`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-500 live-dot" : "bg-amber-400"}`} />
              <span className="hidden sm:inline">{isLive ? "Live Data" : "Sample Data"}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI-Powered</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
