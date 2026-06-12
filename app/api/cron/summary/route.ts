/**
 * GET /api/cron/summary
 *
 * Vercel Cron job: sends daily summary email to each workspace owner at 8 AM.
 * Cron schedule (vercel.json): "0 8 * * *"  (08:00 UTC daily)
 * Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { validateCronSecret, todayUTCStart, daysAgo } from "@/lib/utils";
import { sendEmail } from "@/lib/emails/send";
import { DailySummaryEmail } from "@/emails/templates/DailySummary";
import { getStageCounts, getConversionRate7d } from "@/db/queries";
import type { DailySummaryData, LifecycleStage } from "@/types";
import React from "react";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // Fetch all workspaces with their owner email
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*, owner:owner_id(email)");

  let sent = 0;

  for (const ws of workspaces ?? []) {
    try {
      const ownerEmail = (ws.owner as { email: string } | null)?.email;
      if (!ownerEmail) continue;

      const [stageCounts, conversionRate] = await Promise.all([
        getStageCounts(ws.id),
        getConversionRate7d(ws.id),
      ]);

      // Count emails sent today
      const { count: emailsSentToday } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", ws.id)
        .eq("status", "sent")
        .gte("sent_at", todayUTCStart());

      // Count new signups today
      const { count: newSignupsToday } = await supabase
        .from("end_users")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", ws.id)
        .gte("created_at", todayUTCStart());

      // TODO: wire Lemon Squeezy revenue data once billing is live
      const revenueThisWeek = 0;

      const summaryData: DailySummaryData = {
        workspace: ws,
        emails_sent_today: emailsSentToday ?? 0,
        conversion_rate_7d: conversionRate,
        revenue_this_week: revenueThisWeek,
        stage_breakdown: stageCounts as Record<LifecycleStage, number>,
        new_signups_today: newSignupsToday ?? 0,
      };

      await sendEmail({
        to: ownerEmail,
        subject: `ConversionCRM Daily Summary – ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
        react: React.createElement(DailySummaryEmail, { data: summaryData }),
        trigger: "daily_summary",
        workspaceId: ws.id,
        userId: "__workspace_owner__",
        replyTo: ws.reply_to_email ?? ownerEmail,
        workspace: {
          email_sender_name: ws.email_sender_name,
          product_name: ws.product_name,
          name: ws.name,
        },
        metadata: { recipient_type: "workspace_owner" },
      });

      sent++;
    } catch (err) {
      console.error(`[Cron/summary] workspace ${ws.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
