"use client";

import { useState } from "react";
import { Users, DollarSign, Shield, BarChart3 } from "lucide-react";
import Header from "@/components/Header";
import TexasPulse from "@/components/TexasPulse";
import MetricCard from "@/components/MetricCard";
import ExecutiveAttention from "@/components/ExecutiveAttention";
import StateSelector from "@/components/StateSelector";
import EnrollmentChart from "@/components/EnrollmentChart";
import ComparisonTable from "@/components/ComparisonTable";
import RiskOpportunityChart from "@/components/RiskOpportunityChart";
import SignalsFeed from "@/components/SignalsFeed";
import AlertsFeed from "@/components/AlertsFeed";
import ChartErrorBoundary from "@/components/ChartErrorBoundary";
import {
  sampleStateSummaries,
  sampleAlerts,
} from "@/lib/sample-data";

export default function Home() {
  const [selectedStates, setSelectedStates] = useState<string[]>([
    "CA", "FL", "NY",
  ]);

  // Filter table data to show anchor + selected states
  const tableData = sampleStateSummaries.filter(
    (s) => s.stateCode === "TX" || selectedStates.includes(s.stateCode)
  );

  // Texas data for the hero metrics
  const texas = sampleStateSummaries.find((s) => s.stateCode === "TX");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-deep)" }}>
      {/* Sticky header */}
      <Header />

      {/* Texas Pulse ribbon - always visible, data-rich ticker */}
      <TexasPulse />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* === SECTION 1: Texas at a Glance — Hero Metrics === */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Texas at a Glance
            </h2>
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
              style={{ background: "var(--texas-dim)", color: "var(--texas-primary)" }}
            >
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

        {/* === SECTION 2: Executive Intelligence — Two-column layout === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left column: Executive Attention + Enrollment Chart */}
          <div className="lg:col-span-2 space-y-6">
            <ExecutiveAttention />

            <ChartErrorBoundary fallbackMessage="Unable to render enrollment trends">
              <EnrollmentChart states={selectedStates} />
            </ChartErrorBoundary>
          </div>

          {/* Right column: Signals + Alerts */}
          <div className="space-y-6">
            <SignalsFeed />
            <AlertsFeed alerts={sampleAlerts} />
          </div>
        </div>

        {/* === SECTION 3: Peer-State Benchmarking === */}
        <section className="mb-8">
          <StateSelector
            selectedStates={selectedStates}
            onSelectionChange={setSelectedStates}
          />
        </section>

        <section className="mb-8">
          <ComparisonTable data={tableData} />
        </section>

        {/* === SECTION 4: Risk & Opportunity Matrix === */}
        <section className="mb-8">
          <ChartErrorBoundary fallbackMessage="Unable to render risk/opportunity matrix">
            <RiskOpportunityChart />
          </ChartErrorBoundary>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
          <span>National Medicaid Intelligence Dashboard v0.2</span>
          <span>Data sourced from public federal datasets | AI-powered analysis</span>
        </div>
      </footer>
    </div>
  );
}
