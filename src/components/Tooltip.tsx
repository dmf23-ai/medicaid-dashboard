"use client";

import React, { useState, useRef } from "react";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom";
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);

  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);
  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => setIsVisible(false);

  const positionClasses =
    position === "bottom"
      ? "bottom-full mb-2 -translate-y-1"
      : "top-full mt-2 translate-y-0";

  return (
    <div className="relative inline-flex">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-describedby={isVisible ? tooltipId.current : undefined}
        className="inline-flex"
      >
        {children}
      </div>

      {isVisible && (
        <div
          id={tooltipId.current}
          role="tooltip"
          className={`absolute left-1/2 -translate-x-1/2 ${positionClasses} z-50 inline-block max-w-xs rounded-lg border px-3 py-2 shadow-lg transition-opacity duration-200 opacity-100`}
          style={{
            backgroundColor: "var(--bg-surface, #111827)",
            borderColor: "var(--border-default, #2A3547)",
            color: "var(--text-primary, #F1F5F9)",
          }}
        >
          <p className="whitespace-normal text-xs leading-snug">{content}</p>

          {/* Caret/Arrow */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 ${
              position === "bottom" ? "-top-1" : "-bottom-1"
            }`}
            style={{
              backgroundColor: "var(--bg-surface, #111827)",
              borderTop:
                position === "bottom"
                  ? `1px solid var(--border-default, #2A3547)`
                  : undefined,
              borderRight:
                position === "bottom"
                  ? `1px solid var(--border-default, #2A3547)`
                  : undefined,
              borderBottom:
                position === "top"
                  ? `1px solid var(--border-default, #2A3547)`
                  : undefined,
              borderLeft:
                position === "top"
                  ? `1px solid var(--border-default, #2A3547)`
                  : undefined,
              transform:
                position === "bottom"
                  ? "translate(-50%, -50%) rotate(45deg)"
                  : "translate(-50%, 50%) rotate(45deg)",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
