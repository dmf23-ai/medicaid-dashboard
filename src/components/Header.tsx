"use client";

import { Activity, Database, Brain } from "lucide-react";

export default function Header() {
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
              <span>50 states</span>
              <span className="text-[#2A3547]">|</span>
              <span>Last updated: Mar 2026</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium">
              <div className="w-2 h-2 bg-emerald-500 rounded-full live-dot" />
              <span className="hidden sm:inline">Live Data</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E293B] text-[#A78BFA] rounded-full text-xs font-medium">
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI-Powered</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
