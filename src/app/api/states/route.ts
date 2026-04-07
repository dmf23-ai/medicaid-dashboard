import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/states
 *
 * Returns enrollment data for all states.
 * Tries to load processed data from the pipeline output first.
 * Falls back to sample data if the pipeline hasn't run yet.
 */
export async function GET() {
  // Try to load live pipeline data
  const pipelineDataPath = path.join(
    process.cwd(),
    "public",
    "data",
    "enrollment.json"
  );

  try {
    const raw = await fs.readFile(pipelineDataPath, "utf-8");
    const data = JSON.parse(raw);

    // Verify the data has the expected shape
    if (data.states && Array.isArray(data.states) && data.states.length > 0) {
      return NextResponse.json({
        source: "pipeline",
        updated: data.updated,
        national: data.national,
        states: data.states,
        trends: data.trends || {},
      });
    }
  } catch {
    // Pipeline data not available — fall through to sample data
  }

  // Fall back to sample data (imported at build time)
  return NextResponse.json({
    source: "sample",
    updated: new Date().toISOString(),
    message: "Using sample data. Run the data pipeline to load live data.",
    national: {
      totalEnrollment: 75_726_000,
      statesReporting: 51,
      latestPeriod: "2025-12",
    },
  });
}
