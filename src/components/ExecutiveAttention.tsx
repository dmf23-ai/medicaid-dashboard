"use client";

import React, { useState } from "react";
import {
  Brain,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Target,
  TrendingUp,
  Clock,
} from "lucide-react";
import { ExecutiveInsight } from "@/lib/types";
import { sampleInsights } from "@/lib/sample-data";
import { Tooltip as TooltipHint } from "./Tooltip";
import { SourceLink } from "./SourceLink";

const DEFAULT_VISIBLE = 2;

export default function ExecutiveAttention() {
  const insights = sampleInsights;
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleInsights = isExpanded
    ? insights
    : insights.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = insights.length - DEFAULT_VISIBLE;

  // Category color mapping
  const categoryColors: Record<
    string,
    { bg: string; text: string; badge: string }
  > = {
    operational: {
      bg: "bg-opacity-10",
      text: "text-cyan-400",
      badge: "bg-cyan-400 bg-opacity-20 text-cyan-300",
    },
    financial: {
      bg: "bg-opacity-10",
      text: "text-amber-400",
      badge: "bg-amber-400 bg-opacity-20 text-amber-300",
    },
    regulatory: {
      bg: "bg-opacity-10",
      text: "text-purple-400",
      badge: "bg-purple-400 bg-opacity-20 text-purple-300",
    },
    competitive: {
      bg: "bg-opacity-10",
      text: "text-orange-400",
      badge: "bg-orange-400 bg-opacity-20 text-orange-300",
    },
    quality: {
      bg: "bg-opacity-10",
      text: "text-emerald-400",
      badge: "bg-emerald-400 bg-opacity-20 text-emerald-300",
    },
  };

  // Impact level color mapping
  const impactColors: Record<string, { border: string; bg: string; text: string }> = {
    critical: {
      border: "border-l-red-500",
      bg: "bg-red-400 bg-opacity-20",
      text: "text-red-300",
    },
    high: {
      border: "border-l-amber-500",
      bg: "bg-amber-400 bg-opacity-20",
      text: "text-amber-300",
    },
    moderate: {
      border: "border-l-blue-500",
      bg: "bg-blue-400 bg-opacity-20",
      text: "text-blue-300",
    },
  };

  const categoryColorHex: Record<string, string> = {
    operational: "#22D3EE",
    financial: "#F59E0B",
    regulatory: "#A78BFA",
    competitive: "#F97316",
    quality: "#10B981",
  };

  const getConfidenceIndicator = (confidence: string) => {
    const dotSize = "w-1.5 h-1.5 rounded-full";
    if (confidence === "high") {
      return (
        <div className="flex gap-1 items-center">
          <div className={`${dotSize} bg-emerald-400`} />
          <div className={`${dotSize} bg-emerald-400`} />
          <div className={`${dotSize} bg-emerald-400`} />
        </div>
      );
    } else if (confidence === "medium") {
      return (
        <div className="flex gap-1 items-center">
          <div className={`${dotSize} bg-amber-400`} />
          <div className={`${dotSize} bg-amber-400`} />
          <div className={`${dotSize} bg-slate-600`} />
        </div>
      );
    } else {
      return (
        <div className="flex gap-1 items-center">
          <div className={`${dotSize} bg-slate-500`} />
          <div className={`${dotSize} bg-slate-600`} />
          <div className={`${dotSize} bg-slate-700`} />
        </div>
      );
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-slate-200" />
          <h2 className="text-2xl font-bold text-slate-100">
            Executive Attention Now
          </h2>
        </div>
        <TooltipHint content="Insights are ranked by AI based on strategic relevance, time-sensitivity, and potential impact to Accenture's TX HHSC contract position">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700 bg-opacity-50 border border-slate-600 border-dashed">
            <Sparkles className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-medium text-slate-300">AI-Ranked</span>
          </div>
        </TooltipHint>
      </div>

      {/* Insights Stack */}
      <div className="space-y-4">
        {visibleInsights.map((insight) => {
          const catColor = categoryColors[insight.category];
          const impactColor = impactColors[insight.impactLevel];

          return (
            <div
              key={insight.id}
              className={`group relative border-l-4 ${impactColor.border} bg-slate-950 border border-slate-700 rounded-lg p-5 transition-all duration-200 hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900`}
            >
              {/* Rank and Header Row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                  {/* Rank Circle */}
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-slate-600 bg-slate-900">
                    <span className="text-sm font-bold text-slate-200">
                      {insight.rank}
                    </span>
                  </div>

                  {/* Title and Badges */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-100">
                        {insight.title}
                      </h3>
                    </div>

                    {/* Badge Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Category Badge */}
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${catColor.badge}`}
                      >
                        {insight.category.charAt(0).toUpperCase() +
                          insight.category.slice(1)}
                      </span>

                      {/* Impact Level Badge */}
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${impactColor.bg} ${impactColor.text}`}
                      >
                        {insight.impactLevel.charAt(0).toUpperCase() +
                          insight.impactLevel.slice(1)}
                      </span>

                      {/* Confidence Indicator */}
                      <TooltipHint content="Confidence level: High (3 dots), Medium (2 dots), Low (1 dot) — based on source reliability and data recency">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 bg-opacity-60 border border-dashed border-slate-600">
                          {getConfidenceIndicator(insight.confidence)}
                          <span className="text-xs text-slate-400 ml-1">
                            {insight.confidence.charAt(0).toUpperCase() +
                              insight.confidence.slice(1)}
                          </span>
                        </div>
                      </TooltipHint>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <p className="text-slate-300 text-sm mb-4 ml-12">
                {insight.summary}
              </p>

              {/* Why It Matters Section */}
              <div className="ml-12 mb-4 p-3 rounded-lg bg-slate-800 bg-opacity-40 border border-slate-700 border-opacity-50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Why it matters
                </p>
                <p className="text-sm text-slate-300">{insight.whyItMatters}</p>
              </div>

              {/* Related States */}
              {insight.relatedStates.length > 0 && (
                <div className="ml-12 mb-4 flex items-center gap-2 flex-wrap">
                  {insight.relatedStates.map((state) => (
                    <span
                      key={state}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-700 bg-opacity-50 text-slate-200 border border-slate-600"
                    >
                      {state}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Prompt Box */}
              <div className="ml-12 mb-4 p-3.5 rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-600 flex items-start gap-3">
                <Target className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-200 font-medium">
                    {insight.actionPrompt}
                  </p>
                  <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Footer: Source and Timestamp */}
              <div className="ml-12 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <span>{insight.source}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(insight.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more / Collapse toggle */}
      {hiddenCount > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 bg-opacity-60 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-colors text-sm font-medium text-slate-300 hover:text-slate-100"
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show {hiddenCount} more {hiddenCount === 1 ? "insight" : "insights"}
              </>
            )}
          </button>
        </div>
      )}

      {/* Source Link */}
      <SourceLink label="AI Intelligence Analysis (Claude)" date="Mar 2026" />
    </div>
  );
}
