import { readFile } from "fs/promises";
import { join } from "path";

/**
 * POST /api/ask — Ask Claude about the Medicaid dashboard.
 *
 * Sends the user's question to the Anthropic API with a system prompt that
 * contextualises the National Medicaid Intelligence Dashboard. Falls back to
 * a friendly stub response when the ANTHROPIC_API_KEY env var is missing.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are the AI analyst embedded in the National Medicaid Intelligence Dashboard, a tool built for senior leaders on Accenture's Texas HHSC Medicaid engagement.

Your job is to answer questions about Medicaid data, policy, procurement, and strategy — always through the lens of what matters to the Accenture account team working with the Texas Health and Human Services Commission.

Guidelines:
- Be concise. Answers should be 2–4 short paragraphs max.
- Ground answers in publicly available Medicaid data (CMS enrollment, expenditure, quality measures, Federal Register, OIG reports) when possible.
- When you reference a data point, mention the source (e.g. "CMS Monthly Enrollment data" or "KFF State Health Facts").
- If a question is outside the Medicaid / HHSC domain, say so briefly and redirect.
- Never fabricate statistics. If you don't have a number, say so.
- Use plain business language — the audience is account directors and engagement leads, not data engineers.`;

const DATA_FILES = [
  "enrollment.json",
  "expenditure.json",
  "intelligence.json",
  "managed_care.json",
  "quality.json",
  "signals.json",
];

async function loadDashboardContext(): Promise<string> {
  const dataDir = join(process.cwd(), "public", "data");
  const sections: string[] = [];
  for (const file of DATA_FILES) {
    try {
      const content = await readFile(join(dataDir, file), "utf-8");
      sections.push(`--- ${file} ---\n${content}`);
    } catch {
      // Skip any missing file
    }
  }
  return sections.join("\n\n");
}

interface AskRequest {
  question?: unknown;
}

interface AnthropicMessage {
  role: string;
  content: string | Array<{ type: string; text: string }>;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message: string };
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

  // If no API key, return a helpful stub
  if (!ANTHROPIC_API_KEY) {
    return Response.json({
      text: [
        "The Ask Claude feature requires an Anthropic API key.",
        "",
        `You asked: "${question}"`,
        "",
        "To enable live AI answers, add the ANTHROPIC_API_KEY environment variable in your Vercel project settings (Settings → Environment Variables) and redeploy.",
      ].join("\n"),
    });
  }

  try {
    const messages: AnthropicMessage[] = [
      { role: "user", content: question },
    ];

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: `${SYSTEM_PROMPT}\n\n--- CURRENT DASHBOARD DATA ---\nBelow is a JSON snapshot of the live dashboard. Reference specific values when answering.\n\n${await loadDashboardContext()}`,
        messages,
      }),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      console.error("Anthropic API error:", resp.status, errorBody);
      return Response.json(
        {
          text: "Sorry, I wasn't able to reach the AI service right now. Please try again in a moment.",
        },
        { status: 502 }
      );
    }

    const result = (await resp.json()) as AnthropicResponse;
    const text =
      result.content
        ?.filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n\n") || "No response generated.";

    return Response.json({ text });
  } catch (err) {
    console.error("Ask Claude error:", err);
    return Response.json(
      {
        text: "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
