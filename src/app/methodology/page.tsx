import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Methodology | National Medicaid Intelligence Dashboard",
  description:
    "How the National Medicaid Intelligence Dashboard gathers, ranks, and verifies the data it surfaces.",
};

export default function MethodologyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-deep)" }}>
      {/* Header bar */}
      <div
        className="border-b sticky top-0 z-20 backdrop-blur-sm"
        style={{
          background: "rgba(10, 14, 26, 0.85)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Methodology
          </span>
        </div>
      </div>

      {/* Body */}
      <main
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        style={{ color: "var(--text-primary)" }}
      >
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Methodology</h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            This page explains how each section of the National Medicaid
            Intelligence Dashboard is assembled — what sources are queried,
            how items are ranked, and how AI is involved in shaping what
            appears on screen.
          </p>
        </header>

        {/* Table of contents */}
        <nav
          className="mb-12 p-5 rounded-xl border"
          style={{
            background: "var(--bg-surface, #111827)",
            borderColor: "var(--border-subtle, #1E293B)",
          }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            On this page
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="#executive-attention"
                className="hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                Executive Attention — AI Insight Ranking
              </a>
            </li>
            <li>
              <a
                href="#signals"
                className="hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                Signals from the Edge — External Monitoring
              </a>
            </li>
            <li>
              <a
                href="#alerts"
                className="hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                Intelligence Alerts — Anomaly Detection
              </a>
            </li>
            <li>
              <a
                href="#risk-opportunity"
                className="hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                Risk &amp; Opportunity Matrix — Priority Scoring
              </a>
            </li>
            <li>
              <a
                href="#limitations"
                className="hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                Limitations &amp; Caveats
              </a>
            </li>
          </ul>
        </nav>

        <Section
          id="executive-attention"
          title="Executive Attention — AI Insight Ranking"
        >
          <p>
            The Executive Attention cards surface the handful of items that a
            senior leader on the Texas HHSC Medicaid engagement should know
            about this week. Each card is a synthesis of multiple underlying
            signals — a procurement forecast, a CMS release, an anomaly in
            enrollment data — packaged with a short &ldquo;why it
            matters&rdquo; explanation and a concrete action prompt.
          </p>
          <p>
            Ranking is produced by Claude (Anthropic) with the dashboard&rsquo;s
            current state as input. The model is prompted to weigh three
            factors:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Strategic relevance</strong> to the Accenture TX HHSC
              contract position (incumbency, scope adjacency, amendment
              exposure).
            </li>
            <li>
              <strong>Time-sensitivity</strong>: how quickly the reader has to
              act before the window closes.
            </li>
            <li>
              <strong>Impact magnitude</strong>: scale of the dollar, policy,
              or reputational stakes.
            </li>
          </ul>
          <p>
            Each card carries a confidence indicator (high / medium / low)
            reflecting source reliability and data recency. Items are
            regenerated on a schedule; users can mark cards as &ldquo;reviewed&rdquo;
            to dim them without removing them from the feed.
          </p>
          <p>
            The ranking prompt has access to the signals, alerts, and
            risk-opportunity feeds below, plus a curated set of procurement
            and policy sources.
          </p>
        </Section>

        <Section
          id="signals"
          title="Signals from the Edge — External Monitoring"
        >
          <p>
            Signals from the Edge tracks external developments that may shape
            Accenture&rsquo;s position before they show up in enrollment or
            spending data. The feed pulls from six categories: procurement,
            policy, regulatory, OIG, CMS, and legislative.
          </p>
          <p>
            In the live pipeline, items are gathered from public sources
            including Texas SmartBuy, CMS.gov, the Federal Register,
            congressional committee pages, HHS OIG reports, and state
            procurement portals (Ohio, Louisiana, Georgia, and others). A
            scheduled crawler normalizes each item into a common shape — title,
            summary, category, relevance band, affected states, and a source
            URL — and dedupes against prior runs.
          </p>
          <p>
            Relevance (high / medium / low) is assigned by a lightweight
            classifier tuned to the Texas HHSC engagement. A human reviewer
            can promote or demote items; overrides persist across crawls.
          </p>
          <p>
            The category filter pills filter client-side; as the feed grows,
            the same filters will move to server-driven queries.
          </p>
        </Section>

        <Section
          id="alerts"
          title="Intelligence Alerts — Anomaly Detection"
        >
          <p>
            Intelligence Alerts flags significant changes in Medicaid data
            that deviate from expected patterns. Alerts span four types:
            enrollment change, spending spike, policy change, and quality
            alert.
          </p>
          <p>
            The detection pipeline compares each state&rsquo;s monthly CMS data
            against a rolling baseline and against a peer-state reference
            group (matched on expansion status and managed care penetration).
            Deviations beyond a configurable threshold are lifted into the
            feed with a severity level (critical / high / medium / low).
          </p>
          <p>
            Alerts are then passed through Claude for a short human-readable
            summary and a suggested interpretation. The model does not change
            the severity or add alerts that the detector did not flag — its
            role is explanatory.
          </p>
          <p>
            Each alert carries a link to the originating source
            (CMS dataset, KFF tracker, 1115 waiver page, or similar) so the
            reader can verify the underlying data.
          </p>
        </Section>

        <Section
          id="risk-opportunity"
          title="Risk & Opportunity Matrix — Priority Scoring"
        >
          <p>
            The Risk &amp; Opportunity Matrix plots tracked items on a two-axis
            grid: opportunity (x-axis) against risk (y-axis), with bubble size
            encoding impact. The four quadrants are Backburner (low risk, low
            opportunity), Pursue (low risk, high opportunity), Defend (high
            risk, low opportunity), and Executive Priority (high risk, high
            opportunity).
          </p>
          <p>
            Each item is scored on three 0–100 dimensions by Accenture
            intelligence analysis, drawing on the signals feed, alert history,
            and contract knowledge:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Risk</strong> — downside exposure if the item plays out
              unfavorably.
            </li>
            <li>
              <strong>Opportunity</strong> — upside if the item is pursued or
              shaped.
            </li>
            <li>
              <strong>Impact</strong> — overall magnitude (dollars, scope,
              reputation).
            </li>
          </ul>
          <p>
            The ranked list on the right of the chart orders items by a
            weighted priority score:
          </p>
          <pre
            className="p-3 rounded-lg text-xs overflow-x-auto"
            style={{
              background: "var(--bg-surface, #111827)",
              border: "1px solid var(--border-subtle, #1E293B)",
              color: "var(--text-secondary)",
            }}
          >
{`priority = impact × 0.50 + opportunity × 0.35 + risk × 0.15`}
          </pre>
          <p>
            Weighting intentionally favors impact and opportunity, so that
            large positive moves rank above medium-sized defensive plays. The
            weights are configurable and will be tuned against real outcomes
            once the live pipeline has a few months of history.
          </p>
          <p>
            New items are proposed by the signals pipeline and promoted into
            the matrix after a short human review.
          </p>
        </Section>

        <Section id="limitations" title="Limitations & Caveats">
          <p>
            A few things to keep in mind when reading the dashboard:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>AI-assisted, not AI-authoritative.</strong> Where AI is
              used (Executive Attention ranking, alert summarization, the Ask
              Claude panel), the model is always working from underlying data
              that a human can verify. Treat AI output as a prioritization and
              explanation layer, not as ground truth.
            </li>
            <li>
              <strong>Source recency varies.</strong> CMS monthly enrollment
              data typically lags 60–90 days. Procurement forecasts update on
              state-specific cadences. Alerts are only as fresh as the most
              recent data refresh.
            </li>
            <li>
              <strong>Confidence indicators are directional.</strong>
              High/medium/low confidence bands reflect source quality and data
              recency, not statistical confidence intervals.
            </li>
            <li>
              <strong>No PHI or PII.</strong> All data on the dashboard is
              aggregated at the state level or higher. No individual-level
              records are ingested, stored, or displayed.
            </li>
          </ul>
        </Section>

        <footer
          className="mt-16 pt-8 text-xs"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          <p>
            National Medicaid Intelligence Dashboard · Methodology · v1.0
          </p>
          <p className="mt-1">
            Questions or corrections? Reach out to the dashboard owner on the
            Accenture TX HHSC team.
          </p>
        </footer>
      </main>
    </div>
  );
}

interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2
        className="text-2xl font-bold mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      <div
        className="space-y-4 text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {children}
      </div>
    </section>
  );
}
