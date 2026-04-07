"use client";

import { useState } from "react";
import { Users, DollarSign, Shield, BarChart3 } from "lucide-react";
import Header from "@/components/Header";
import MetricCard from "@/components/MetricCard";
import StateSelector from "@/components/StateSelector";
import EnrollmentChart from "@/components/EnrollmentChart";
import ComparisonTable from "@/components/ComparisonTable";
import AlertsFeed from "@/components/AlertsFeed";
import IntelligenceBriefing from "@/components/IntelligenceBriefing";
import ChartErrorBoundary from "@/components/ChartErrorBoundary";
import { useDashboardData } from "@/lib/use-dashboard-data";

export default function Home() {
  const { states, trends, alerts, intelligence, dataSource, lastUpdated, isLoading } =
    useDashboardData();

  const [selectedStates, setSelectedStates] = useState<string[]>([
    "CA", "FL", "NY",
  ]);

  // Filter table data to show anchor + selected states
  const tableData = states.filter(
    (s) => s.stateCode === "TX" || selectedStates.includes(s.stateCode)
  );

  // Texas data for the hero metrics
  const texas = states.find((s) => s.stateCode === "TX");

  return (
    <div className="min-h-screen bg-slate-50">
      <Header dataSource={dataSource} lastUpdated={lastUpdated} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Data source banner (when using sample data) */}
        {!isLoading && dataSource === "sample" && (
          <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-800">
            <span className="font-semibold">Sample data.</span>
            <span>
              Run the data pipeline (<code className="bg-amber-100 px-1 rounded">python orchestrator.py</code>) to load live enrollment data from CMS.
            </span>
          </div>
        )}

        {/* Hero Metrics - Texas overview */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-900">Texas at a Glance</h2>
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full font-semibold">
              Anchor State
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Enrollment"
              value={texas ? texas.enrollment.toLocaleString() : "—"}
              change={texas?.enrollmentChange}
              changeLabel="YoY"
              icon={<Users className="w-5 h-5" />}
              highlight
            />
            <MetricCard
              title="Per-Enrollee Spending"
              value={texas ? `$${texas.perEnrolleeSpending.toLocaleString()}` : "—"}
              change={4.2}
              changeLabel="YoY"
              icon={<DollarSign className="w-5 h-5" />}
              invertTrend
            />
            <MetricCard
              title="Managed Care Rate"
              value={texas ? `${texas.managedCarePenetration}%` : "—"}
              icon={<Shield className="w-5 h-5" />}
            />
            <MetricCard
              title="Quality Score"
              value={texas ? `${texas.qualityScore}/100` : "—"}
              change={-2.1}
              changeLabel="YoY"
              icon={<BarChart3 className="w-5 h-5" />}
            />
          </div>
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Charts + Table (spans 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <StateSelector
              selectedStates={selectedStates}
              onSelectionChange={setSelectedStates}
            />

            <ChartErrorBoundary fallbackMessage="Unable to render enrollment trends">
              <EnrollmentChart states={selectedStates} trends={trends} />
            </ChartErrorBoundary>

            <ComparisonTable data={tableData} />
          </div>

          {/* Right column: AI Briefing + Alerts + Info */}
          <div className="space-y-6">
            <IntelligenceBriefing data={intelligence} />
            <AlertsFeed alerts={alerts} />

            {/* Data Sources Attribution */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Data Sources
              </h3>
              <div className="space-y-2">
                {[
                  { name: "data.medicaid.gov", desc: "Enrollment & expenditure" },
                  { name: "CMS Core Set", desc: "Quality measures" },
                  { name: "MACPAC MACStats", desc: "Spending analysis" },
                  { name: "KFF State Health Facts", desc: "Policy tracking" },
                ].map((source) => (
                  <div key={source.name} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    <span className="text-xs font-medium text-slate-700">
                      {source.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {source.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture Note */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                How This Works
              </h3>
              <p className="text-xs text-blue-700 leading-relaxed">
                This dashboard is powered by a multi-agent data pipeline that
                automatically collects, normalizes, and analyzes Medicaid data
                from federal APIs. AI agents generate state briefings and
                detect anomalies across 50 states in real time.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {["Data Agents", "AI Analysis", "Live APIs", "50 States"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 bg-white/70 text-blue-700 rounded-full font-medium"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-8 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>National Medicaid Intelligence Dashboard v0.1</span>
          <span>Data sourced from public federal datasets</span>
        </div>
      </footer>
    </div>
  );
}
