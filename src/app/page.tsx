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
import SpendingBreakdownChart from "@/components/SpendingBreakdownChart";
import StateDetailPanel from "@/components/StateDetailPanel";
import { useDashboardData } from "@/lib/use-dashboard-data";

export default function Home() {
  const [selectedStates, setSelectedStates] = useState<string[]>([
    "CA",
    "FL",
    "NY",
  ]);
  const [detailStateCode, setDetailStateCode] = useState<string | null>(null);

  // Load live pipeline data with sample fallback
  const {
    states,
    trends,
    alerts,
    dataSource,
    lastUpdated,
  } = useDashboardData();

  // Filter table data to show anchor + selected states
  const tableData = states.filter(
    (s) => s.stateCode === "TX" || selectedStates.includes(s.stateCode)
  );

  // Texas data for the hero metrics
  const texas = states.find((s) => s.stateCode === "TX");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-deep)" }}>
      {/* Sticky header */}
      <Header dataSource={dataSource} lastUpdated={lastUpdated} />

      {/* Texas Pulse ribbon - always visible, data-rich ticker */}
      <TexasPulse />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* === SECTION 1: Texas at a Glance — Hero Metrics === */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Texas at a Glance
            </h2>
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
              style={{
                background: "var(--texas-dim)",
                color: "var(--texas-primary)",
              }}
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
              tooltip="Total individuals enrolled in Texas Medicaid & CHIP. Year-over-year change reflects enrollment growth or decline."
              sourceLabel="CMS Monthly Medicaid & CHIP Enrollment"
              sourceUrl="https://data.medicaid.gov/"
            />
            <MetricCard
              title="Per-Enrollee Spending"
              value={
                texas ? `$${texas.perEnrolleeSpending.toLocaleString()}` : "—"
              }
              change={4.2}
              changeLabel="YoY"
              icon={<DollarSign className="w-5 h-5" />}
              invertTrend
              tooltip="Average annual Medicaid spending per enrollee in Texas. Lower can indicate efficiency or access concerns."
              sourceLabel="CMS MBES/CBES (CMS-64)"
              sourceUrl="https://www.medicaid.gov/medicaid/financial-management/state-expenditure-reporting/expenditure-reports/index.html"
            />
            <MetricCard
              title="Managed Care Rate"
              value={texas ? `${texas.managedCarePenetration}%` : "—"}
              icon={<Shield className="w-5 h-5" />}
              tooltip="Share of Texas Medicaid enrollees served through managed care organizations (STAR, STAR+PLUS, STAR Kids, STAR Health)."
              sourceLabel="CMS Medicaid Managed Care Enrollment Report"
              sourceUrl="https://www.medicaid.gov/medicaid/managed-care/enrollment/index.html"
            />
            <MetricCard
              title="Quality Score"
              value={texas ? `${texas.qualityScore}/100` : "—"}
              change={-2.1}
              changeLabel="YoY"
              icon={<BarChart3 className="w-5 h-5" />}
              tooltip="Composite quality score based on CMS Adult & Child Core Set measures (preventive care, chronic disease, behavioral health)."
              sourceLabel="CMS Medicaid Core Set Quality Measures"
              sourceUrl="https://www.medicaid.gov/medicaid/quality-of-care/performance-measurement/adult-and-child-health-care-quality-measures/index.html"
            />
          </div>
        </section>

        {/* === SECTION 2: Executive Intelligence — Two-column layout === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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
            <AlertsFeed alerts={alerts} />
          </div>
        </div>

        {/* === SECTION 3: Peer-State Benchmarking === */}
        <section className="mb-6">
          <StateSelector
            selectedStates={selectedStates}
            onSelectionChange={setSelectedStates}
          />
        </section>

        <section className="mb-6">
          <ComparisonTable
            data={tableData}
            onStateClick={(code) => setDetailStateCode(code)}
          />
        </section>

        {/* === SECTION 4: Spending Breakdown === */}
        <section className="mb-6">
          <ChartErrorBoundary fallbackMessage="Unable to render spending breakdown">
            <SpendingBreakdownChart />
          </ChartErrorBoundary>
        </section>

        {/* === SECTION 5: Risk & Opportunity Matrix === */}
        <section className="mb-6">
          <ChartErrorBoundary fallbackMessage="Unable to render risk/opportunity matrix">
            <RiskOpportunityChart />
          </ChartErrorBoundary>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-4"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div
          className="flex items-center justify-between text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <span>National Medicaid Intelligence Dashboard v0.3</span>
          <span>
            Data sourced from public federal datasets | AI-powered analysis
          </span>
        </div>
      </footer>

      {/* State Detail Drill-down Panel */}
      <StateDetailPanel
        stateCode={detailStateCode}
        onClose={() => setDetailStateCode(null)}
        states={states}
        trends={trends}
      />
    </div>
  );
}
