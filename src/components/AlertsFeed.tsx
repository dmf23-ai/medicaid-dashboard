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
      case "high":
      case "critical":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          icon: "text-red-600",
          badge: "bg-red-100 text-red-700",
        };
      case "medium":
      case "warning":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: "text-amber-600",
          badge: "bg-amber-100 text-amber-700",
        };
      case "low":
      case "info":
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: "text-blue-600",
          badge: "bg-blue-100 text-blue-700",
        };
      default:
        return {
          bg: "bg-slate-50",
          border: "border-slate-200",
          icon: "text-slate-600",
          badge: "bg-slate-100 text-slate-700",
        };
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Intelligence Alerts
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            AI-detected changes and notable events
          </p>
        </div>
        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
          {alerts.length} alerts
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const styles = getSeverityStyles(alert.severity);
          return (
            <div
              key={alert.id}
              className={`${styles.bg} border ${styles.border} rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${styles.icon}`}>
                  {getAlertIcon(alert.type || alert.category || "")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-700">
                      {alert.stateCode || (alert.states && alert.states.length > 0 ? alert.states.join(", ") : "National")}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${styles.badge}`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {alert.date || (alert.timestamp ? new Date(alert.timestamp).toLocaleDateString() : "")}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 leading-snug">
                    {alert.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
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
