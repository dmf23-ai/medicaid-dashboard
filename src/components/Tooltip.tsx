"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom";
}

// Note: position semantics are intentionally inverted for back-compat with the
// previous absolute-positioned implementation. `position="top"` places the
// tooltip BELOW the trigger; `position="bottom"` places it ABOVE. Existing
// callers depend on this behavior.
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = "top",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipId = useRef(`tooltip-${Math.random().toString(36).slice(2)}`);

  // SSR guard — portal requires document.body
  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;

    const gap = 8;
    const triggerCenterX = rect.left + rect.width / 2;

    // Measure tooltip if already rendered, otherwise estimate (will snap on next frame)
    const tooltipWidth = tooltipEl?.offsetWidth ?? 240;
    const tooltipHeight = tooltipEl?.offsetHeight ?? 60;

    // "top" (legacy) = BELOW trigger; "bottom" (legacy) = ABOVE trigger
    const top =
      position === "bottom"
        ? rect.top - tooltipHeight - gap
        : rect.bottom + gap;

    // Clamp to viewport horizontally
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : 1024;
    const margin = 8;
    let left = triggerCenterX - tooltipWidth / 2;
    if (left < margin) left = margin;
    if (left + tooltipWidth > viewportWidth - margin) {
      left = viewportWidth - tooltipWidth - margin;
    }

    setCoords({ top, left });
  }, [position]);

  // Recompute position when visible, on scroll, and on resize
  useEffect(() => {
    if (!isVisible) return;

    // Initial measurement
    updatePosition();

    // Second pass once the tooltip has rendered (to measure real size)
    const rafId = requestAnimationFrame(() => updatePosition());

    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isVisible, updatePosition]);

  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);
  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => setIsVisible(false);

  const tooltipNode =
    isVisible && mounted ? (
      <div
        ref={tooltipRef}
        id={tooltipId.current}
        role="tooltip"
        className="pointer-events-none max-w-xs rounded-lg border px-3 py-2 shadow-lg transition-opacity duration-200 opacity-100"
        style={{
          position: "fixed",
          top: coords.top,
          left: coords.left,
          zIndex: 9999,
          backgroundColor: "var(--bg-surface, #111827)",
          borderColor: "var(--border-default, #2A3547)",
          color: "var(--text-primary, #F1F5F9)",
        }}
      >
        <p className="whitespace-normal text-xs leading-snug">{content}</p>
      </div>
    ) : null;

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-describedby={isVisible ? tooltipId.current : undefined}
    >
      <div className="inline-flex">{children}</div>
      {mounted && tooltipNode && createPortal(tooltipNode, document.body)}
    </div>
  );
};

export default Tooltip;
