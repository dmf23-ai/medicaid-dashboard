"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

interface SourceLinkProps {
  label: string;
  url?: string;
  date?: string;
}

export const SourceLink: React.FC<SourceLinkProps> = ({ label, url, date }) => {
  const isInternal = !!url && url.startsWith("/");

  const content = (
    <div
      className="flex items-center gap-1.5 border-t pt-2 mt-3"
      style={{
        borderColor: "var(--border-subtle, #1E293B)",
        color: "var(--text-muted, #475569)",
      }}
    >
      <span className="text-[10px] uppercase tracking-wide">Source: {label}</span>
      {date && <span className="text-[10px] uppercase tracking-wide">·</span>}
      {date && (
        <span className="text-[10px] uppercase tracking-wide">{date}</span>
      )}
      {url && !isInternal && (
        <ExternalLink
          className="w-2.5 h-2.5 ml-0.5 flex-shrink-0"
          aria-hidden="true"
        />
      )}
    </div>
  );

  if (url) {
    // Internal routes: same-tab navigation, no external-link icon.
    // Plain <a> is used (not next/link) because hash-anchored navigation
    // is more reliable with a full document load for cross-route scrolls.
    const externalProps = isInternal
      ? {}
      : { target: "_blank", rel: "noopener noreferrer" };

    return (
      <a
        href={url}
        {...externalProps}
        className="inline-block transition-colors duration-150 hover:opacity-75"
        style={{
          color: "var(--text-muted, #475569)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-tertiary, #64748B)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted, #475569)";
        }}
      >
        {content}
      </a>
    );
  }

  return content;
};

export default SourceLink;
