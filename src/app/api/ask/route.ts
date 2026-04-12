// Ask Claude — powered by the Anthropic Messages API.
//
// Reads the dashboard's current data files from /public/data/ to give Claude
// context about the live metrics, then answers the user's question.

import { readFile } from "fs/promises";
import { join } from "path";

interface AskRequest {
  question?: unknown;
}

const DATA_DIR = join(process.cwd(), "public", "data");

async function loadDataSummary(): Promise<string> {
  const files = [
    "enrollment.json",
    "expenditure.json",
    "quality.json",
    "managed_care.json",
    "signals.json",
    "intelligence.json",
  ];

  const sections: string[] = [];

  for (const file of files) {
    try {
      const raw = await readFile(join(DATA_DIR, file), "utf-8");
      const data = JSON.parse(raw);

      if (file === "enrollment.json" && data.national) {
        const nat = data.national;
        sections.push(
          `ENROLLMENT: ${nat.totalEnrollment?.toLocaleString() ?? "N/A"} total enrollees across ${nat.statesReporting ?? "?"} states. ` +
          `National YoY change: ${nat.enrollmentChange ?? "N/A"}%.`
        );
      }

      if (file === "expenditure.json" && data.national) {
        const nat = data.national;
        sections.push(
          `EXPENDITURE: $${nat.totalExpenditures?.toLocaleString() ?? "N/A"} total (FY${nat.fiscalYear ?? "?"}). ` +
          `Per-enrollee: $${nat.perEnrolleeSpending?.toLocaleString() ?? "N/A"}. ` +
          `${nat.partialYear ? "NOTE: partial fiscal year — YoY comparisons use matching quarters only." : ""}`
        );
      }

      if (file === "quality.json" && data.national) {
        const nat = data.national;
        sections.push(
          `QUALITY: National composite score ${nat.compositeScore ?? "N/A"}/100. ` +
          `Reporting year: ${data.reportingYear ?? "?"}.`
        );
      }

      if (file === "managed_care.json" && data.national) {
        const nat = data.national;
        sections.push(
          `MANAGED CARE: Average penetration ${nat.averagePenetration ?? "N/A"}% across ${nat.statesReporting ?? "?"} states (${nat.year ?? "?"}).`
        );
      }

      if (file === "signals.json" && data.signals) {
        const counts: Record<string, number> = {};
        for (const s of data.signals) {
          counts[s.category] = (counts[s.category] ?? 0) + 1;
        }
        sections.push(
          `SIGNALS: ${data.signals.length} items — ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ")}.`
        );
      }

      if (file === "intelligence.json") {
        if (data.executiveSummary) {
          sections.push(`EXECUTIVE SUMMARY: ${data.executiveSummary.slice(0, 500)}`);
        }
      }
    } catch {
      // File missing or unparseable — skip silently
    }
  }

  return sections.join("\n\n");
}

export async function POST(request: Request) {
  let body: AskRequest = {};
  try {
    body = (await request.json()) as AskRequest;
  } catch {
    // Ignore malformed JSON
  }

  const question =
    typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    return Response.json(
      { text: "Please enter a question and try again." },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({
      text: "The Ask Claude feature requires an Anthropic API key. Please add ANTHROPIC_API_KEY to the environment variables.",
    });
  }

  try {
    const dataSummary = await loadDataSummary();

    const systemPrompt = [
      "You are an AI analyst embedded in the National Medicaid Intelligence Dashboard.",
      "You help senior leadership (specifically the Accenture team on the Texas HHSC Medicaid engagement) understand dashboard data.",
      "Answer concisely and directly. Use specific numbers from the data when available.",
      "If the data doesn't contain what the user is asking about, say so clearly.",
      "",
      "Current dashboard data:",
      dataSummary || "(No pipeline data available — the dashboard may be showing sample data.)",
    ].join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: question }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return Response.json({
        text: `Sorry, I couldn't process your question right now. (API returned ${response.status})`,
      });
    }

    const result = await response.json();
    const text =
      result.content?.[0]?.text ??
      "I received a response but couldn't extract the text. Please try again.";

    return Response.json({ text });
  } catch (err) {
    console.error("Ask Claude error:", err);
    return Response.json({
      text: "Sorry, something went wrong while processing your question. Please try again.",
    });
  }
}
