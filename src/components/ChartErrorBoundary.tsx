"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ChartErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chart rendering error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#111827] rounded-xl border border-[#1E293B] p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
          <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
          <p className="text-sm font-medium text-[#F1F5F9]">
            {this.props.fallbackMessage || "Unable to render chart"}
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            Try selecting different states or refreshing the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 text-xs px-3 py-1.5 bg-[#1E293B] hover:bg-[#2A3547] text-[#94A3B8] rounded-full transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
