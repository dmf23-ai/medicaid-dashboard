"use client";

import React, { useState } from "react";
import {
  Radar,
  FileSearch,
  Gavel,
  Shield,
  AlertOctagon,
  Landmark,
  ScrollText,
  ExternalLink,
} from "lucide-react";
import { SignalItem } from "@/lib/types";
import { sampleSignals } from "@/lib/sample-data";
import { Tooltip as TooltipHint } from "./Tooltip";
import { SourceLink } from "./SourceLink";

type CategoryFilter =
  | "all"
  | "procurement"
  | "policy"
  | "regulatory"
  | "oig"
  | "cms"
  | "legislative";

interface CategoryInfo {
  label: string;
  icon: React.ComponentType<{ size: number; className: string }>;
  dotColor: string;
}

const categoryMap: Record<
  Exclude<SignalItem["category"], undefined>,
  CategoryInfo
> = {
  procurement: {
    label: "Procurement",
    icon: FileSearch,
    dotColor: "bg-orange-500",
  },
  policy: {
    label: "Policy",
    icon: ScrollText,
    dotColor: "bg-purple-500",
  },
  regulatory: {
    label: "Regulatory",
    icon: Gavel,
    dotColor: "bg-cyan-500",
  },
  oig: {
    label: "OIG",
    icon: AlertOctagon,
    dotColor: "bg-red-500",
  },
  cms: {
    label: "CMS",
    icon: Shield,
    dotColor: "bg-blue-500",
  },
  legislative: {
    label: "Legislative",
    icon: Landmark,
    dotColor: "bg-amber-500",
  },
};

const filterOptions: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "procurement", label: "Procurement" },
  { value: "policy", label: "Policy" },
  { value: "regulatory", label: "Regulatory" },
  { value: "oig", label: "OIG" },
  { value: "cms", label: "CMS" },
  { value: "legislative", label: "Legislative" },
];

export default function SignalsFeed() {
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("all");

  const filteredSignals =
    activeFilter === "all"
      ? sampleSignals
      : sampleSignals.filter((signal) => signal.category === activeFilter);

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getRelevanceBorder = (relevance: SignalItem["relevance"]): string => {
    switch (relevance) {
      case "high":
        return "border-l-2 border-l-blue-500";
      case "medium":
        return "border-l-2 border-l-gray-600";
      case "low":
        return "border-l-2 border-l-transparent";
      default:
        return "border-l-2 border-l-transparent";
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-border-subtle overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-3 mb-4">
          <Radar size={20} className="text-accent-blue" />
          <TooltipHint content="External developments in Medicaid policy, procurement, and regulatory activity that may affect Accenture's position">
            <h2 className="text-lg font-semibold text-text-primary border-b border-dashed border-[#475569]">
              Signals from the Edge
            </h2>
          </TooltipHint>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeFilter === option.value
                  ? "bg-accent-blue text-white"
                  : "bg-border-subtle text-text-secondary hover:bg-gray-600"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Signal Items */}
      <div className="divide-y divide-border-subtle">
        {filteredSignals.map((signal, index) => {
          const categoryInfo = categoryMap[signal.category];
          const IconComponent = categoryInfo.icon;

          return (
            <div
              key={signal.id}
              className={`px-6 py-4 hover:bg-gray-900 transition-colors ${getRelevanceBorder(
                signal.relevance
              )} pl-4`}
            >
              {/* Category and Title Row */}
              <div className="flex gap-3">
                {/* Category Indicator */}
                <div className="flex-shrink-0 pt-0.5">
                  <div className={`w-2 h-2 rounded-full ${categoryInfo.dotColor}`} />
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-text-primary mb-1 line-clamp-2">
                    {signal.title}
                  </h3>

                  {/* Summary */}
                  <p className="text-xs text-text-secondary mb-2 line-clamp-2">
                    {signal.summary}
                  </p>

                  {/* Source, Timestamp, and States */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs bg-gray-800 text-text-secondary px-2 py-0.5 rounded">
                      {signal.source}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {formatDate(signal.timestamp)}
                    </span>

                    {/* Affected States Chips */}
                    {signal.affectedStates && signal.affectedStates.length > 0 && (
                      <>
                        <span className="text-xs text-text-tertiary">•</span>
                        <div className="flex gap-1 flex-wrap">
                          {signal.affectedStates.map((state) => (
                            <span
                              key={state}
                              className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded"
                            >
                              {state}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {/* External Link Icon */}
                    {signal.sourceUrl && (
                      <span className="ml-auto inline-flex">
                        <TooltipHint
                          content={`Source: ${signal.source}`}
                          position="top"
                        >
                          <a
                            href={signal.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-tertiary hover:text-accent-blue transition-colors"
                            aria-label={`Open source: ${signal.source}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={14} />
                          </a>
                        </TooltipHint>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {filteredSignals.length === 0 && (
          <div className="px-6 py-8 text-center">
            <p className="text-text-secondary">
              No signals found for this category.
            </p>
          </div>
        )}
      </div>

      {/* Source Link */}
      <div className="px-6 py-4 border-t border-border-subtle">
        <SourceLink
          label="Public procurement portals, CMS.gov, Federal Register"
          url="/methodology#signals"
          date="Mar 2026"
        />
      </div>
    </div>
  );
}
