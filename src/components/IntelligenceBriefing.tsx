"use client";

import { Brain, Sparkles, MapPin } from "lucide-react";
import { IntelligenceData } from "@/lib/use-dashboard-data";

interface IntelligenceBriefingProps {
  data: IntelligenceData | null;
}

export default function IntelligenceBriefing({ data }: IntelligenceBriefingProps) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            AI Intelligence Briefing
          </h3>
        </div>
        <p className="text-xs text-slate-500 italic">
          Run the data pipeline with a Claude API key to generate AI-powered briefings.
        </p>
      </div>
    );
  }

  const sourceLabel = data.source === "claude_api" ? "Claude AI" : "Auto-Generated";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            AI Intelligence Briefing
          </h3>
        </div>
        <span className="flex items-center gap-1 text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
          <Sparkles className="w-3 h-3" />
          {sourceLabel}
        </span>
      </div>

      {/* Executive Summary */}
      {data.executiveSummary && (
        <div>
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Executive Summary
          </h4>
          <div className="text-xs text-slate-700 leading-relaxed space-y-2">
            {data.executiveSummary.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}

      {/* Texas Spotlight */}
      {data.texasSpotlight && (
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3.5 h-3.5 text-red-600" />
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Texas Spotlight
            </h4>
          </div>
          <div className="text-xs text-slate-700 leading-relaxed space-y-2">
            {data.texasSpotlight.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
