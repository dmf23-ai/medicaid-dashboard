"use client";

import React, { useState } from "react";
import {
  Brain,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Target,
  Clock,
  CheckCircle2,
  Check,
} from "lucide-react";
import { ExecutiveInsight } from "@/lib/types";
import { Tooltip as TooltipHint } from "./Tooltip";
import { SourceLink } from "./SourceLink";

const DEFAULT_VISIBLE = 3;

interface ExecutiveAttentionProps {
  insights: ExecutiveInsight[];
}

export default function ExecutiveAttention({ insights }: ExecutiveAttentionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const visibleInsights = isExpanded
    ? insights
    : insights.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = insights.length - DEFAULT_VISIBLE;

  const toggleReviewed = (id: string) => {
    setReviewedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Category color mapping (Tailwind 4 slash-alpha syntax)
  const categoryColors: Record<string, { badge: string }> = {
    operational: {
      badge: "bg-cyan-400/20 text-cyan-200 border border-cyan-400/30",
    },
    financial: {
      badge: "bg-amber-400/20 text-amber-200 border border-amber-400/30",
    },
    regulatory: {
      badge: "bg-purple-400/20 text-purple-200 border border-purple-400/30",
    },
    competitive: {
      badge: "bg-orange-400/20 text-orange-200 border border-orange-400/30",
    },
    quality: {
      badge: "bg-emerald-400/20 text-emerald-200 border border-emerald-400/30",
    },
  };

  // Impact level color mapping
  const impactColors: Record<string, { border: string; badge: string }> = {
    critical: {
      border: "border-l-red-500",
      badge: "bg-red-400/20 text-red-200 border border-red-400/30",
    },
    high: {
      border: "border-l-amber-500",
      badge: "bg-amber-400/20 text-amber-200 border border-amber-400/30",
    },
    moderate: {
      border: "border-l-blue-500",
      badge: "bg-blue-400/20 text-blue-200 border border-blue-400/30",
    },
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/50 border border-slate-600 border-dashed">
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
          const isReviewed = reviewedIds.has(insight.id);

          const actionPromptInner = (
            <>
              <Target className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 flex items-center justify-between gap-2">
                <p className="text-sm text-slate-200 font-medium">
                  {insight.actionPrompt}
                </p>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
            </>
          );

          return (
            <div
              key={insight.id}
              className={`group relative border-l-4 ${impactColor.border} bg-slate-950 border border-slate-700 rounded-lg p-5 transition-all duration-200 hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900 ${
                isReviewed ? "opacity-60" : ""
              }`}
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
                      {isReviewed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                          <Check className="w-3 h-3" />
                          Reviewed
                        </span>
                      )}
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
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${impactColor.badge}`}
                      >
                        {insight.impactLevel.charAt(0).toUpperCase() +
                          insight.impactLevel.slice(1)}
                      </span>

                      {/* Confidence Indicator */}
                      <TooltipHint content="Confidence level: High (3 dots), Medium (2 dots), Low (1 dot) — based on source reliability and data recency">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/60 border border-dashed border-slate-600">
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
              <div className="ml-12 mb-4 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
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
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-700/50 text-slate-200 border border-slate-600"
                    >
                      {state}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Prompt Box — linked when sourceUrl present */}
              {insight.sourceUrl ? (
                <a
                  href={insight.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-12 mb-4 p-3.5 rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-600 flex items-start gap-3 hover:border-slate-500 hover:from-slate-700 hover:to-slate-800 transition-colors cursor-pointer"
                >
                  {actionPromptInner}
                </a>
              ) : (
                <div className="ml-12 mb-4 p-3.5 rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-600 flex items-start gap-3">
                  {actionPromptInner}
                </div>
              )}

              {/* Footer: Source, Timestamp, Mark Reviewed */}
              <div className="ml-12 flex items-center justify-between text-xs text-slate-500 gap-3">
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <span className="truncate">{insight.source}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(insight.timestamp)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleReviewed(insight.id)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-colors ${
                      isReviewed
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/25"
                        : "bg-slate-800/60 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                    }`}
                    aria-pressed={isReviewed}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isReviewed ? "Reviewed" : "Mark reviewed"}
                  </button>
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-colors text-sm font-medium text-slate-300 hover:text-slate-100"
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
      <SourceLink
        label="AI Intelligence Analysis (Claude)"
        url="/methodology#executive-attention"
        date="Mar 2026"
      />
    </div>
  );
}
