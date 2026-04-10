// Stub POST handler for the Ask Claude panel.
//
// This is intentionally a placeholder. A later phase will replace the body
// of this handler with a real call to the Anthropic API, and will extend
// the response shape to carry structured action payloads (filters,
// drill-downs, highlights) alongside the prose, per the hybrid interaction
// model. For now it just echoes the question back in a friendly stub.

interface AskRequest {
  question?: unknown;
}

export async function POST(request: Request) {
  let body: AskRequest = {};
  try {
    body = (await request.json()) as AskRequest;
  } catch {
    // Ignore malformed JSON — we'll fall through with an empty body.
  }

  const question =
    typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    return Response.json(
      {
        text: "Please enter a question and try again.",
      },
      { status: 400 }
    );
  }

  const text = [
    "This is a stub response from the Ask Claude UI preview.",
    "",
    `You asked: "${question}"`,
    "",
    "The real Claude-powered answers will ship in a later phase. When they do, responses will blend a short prose answer with dashboard actions — filters, drill-downs, or highlighted cards — so you can jump straight from a question to the data it points at.",
  ].join("\n");

  return Response.json({ text });
}
