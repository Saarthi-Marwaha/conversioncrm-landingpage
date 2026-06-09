/**
 * GET /api/cron/score
 *
 * Vercel Cron job: runs nightly at midnight UTC to compute weekly engagement
 * scores (0–100) for every tracked user_id per workspace, upsert into
 * engagement_scores, then assign lifecycle stages into stages.
 *
 * Cron schedule (vercel.json): "0 0 * * *"
 * Protected by CRON_SECRET in the Authorization header.
 */
import { NextRequest, NextResponse } from "next/server";
import { assignStages } from "@/lib/cron/assign-stages";
import { runScoring } from "@/lib/cron/run-scoring";
import { validateCronSecret } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scored, errors: scoreErrors, scoredByWorkspace } = await runScoring();
  const { assigned, errors: stageErrors } = await assignStages(scoredByWorkspace);

  const errors = [...scoreErrors, ...stageErrors];

  console.log(
    `[Cron/score] scored=${scored} staged=${assigned} errors=${errors.length}`
  );

  return NextResponse.json({
    ok: true,
    scored,
    assigned,
    errors: errors.slice(0, 20),
  });
}
