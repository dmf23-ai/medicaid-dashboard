"use client";

import {
  AlertTriangle,
  TrendingDown,
  FileText,
  Activity,
} from "lucide-react";
import { DashboardAlert } from "@/lib/types";

interface AlertsFeedProps {
  alerts: DashboardAlert[];
}

export default function AlertsFeed({ alerts }: AlertsFeedProps) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case "enrollment_change":
        return <TrendingDown className="w-4 h-4" />;
      case "spending_spike":
        return <Activity className="w-4 h-4" />;
      case "policy_change":
        return <FileText className="w-4 h-4" />;
      case "quality_alert":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          bg: "bg-[#111827]",
          border: "border-l-[3px] border-l-red-600 border border-[#1E293B]",
          icon: "text-red-500",
          badge: "bg-red-900/50 text-red-300",
        };
      case "high":
        return {
          bg: "bg-[#111827]",
          border: "border-l-[3px] border-l-red-500 border border-[#1E293B]",
          icon: "text-red-400",
          badge: "bg-red-900/40 text-red-400",
        };
      case "medium":
        return {
          bg: "bg-[#111827]",
          border: "border-l-[3px] border-l-amber-500 border border-[#1E293B]",
          icon: "text-amber-400",
          badge: "bg-amber-900/40 text-amber-400",
        };
      case "low":
        return {
          bg: "bg-[#111827]",
          border: "border-l-[3px] border-l-blue-500 border border-[#1E293B]",
          icon: "text-blue-400",
          badge: "bg-blue-900/40 text-blue-400",
        };
      default:
        return {
          bg: "bg-[#111827]",
          border: "border-l-[3px] border-l-slate-500 border border-[#1E293B]",
          icon: "text-slate-400",
          badge: "bg-slate-900/40 text-slate-400",
        };
    }
  };

  return (
    <div className="bg-[#111827] rounded-xl border border-[#1E293B] p-5 hover:border-[#2A3547] transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#F1F5F9]">
            Intelligence Alerts
          </h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            AI-detected changes and notable events
          </p>
        </div>
        <span className="text-xs px-2 py-1 bg-[#1E293B] text-[#94A3B8] rounded-full">
          {alerts.length} alerts
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const styles = getSeverityStyles(alert.severity);
          return (
            <div
              key={alert.id}
              className={`${styles.bg} ${styles.border} rounded-lg p-3 cursor-pointer hover:border-[#2A3547] transition-colors`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${styles.icon}`}>
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#F1F5F9]">
                      {alert.stateCode}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${styles.badge}`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-[#475569] ml-auto">
                      {alert.date}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#F1F5F9] leading-snug">
                    {alert.title}
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    {alert.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
