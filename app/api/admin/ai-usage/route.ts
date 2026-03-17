export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const [currentMonth, prevMonth, dailyBreakdown] = await Promise.all([
      supabase
        .from("ai_usage")
        .select("feature, input_tokens, output_tokens, duration_ms, created_at")
        .gte("created_at", startOfMonth),
      supabase
        .from("ai_usage")
        .select("feature, input_tokens, output_tokens")
        .gte("created_at", startOfPrevMonth)
        .lte("created_at", endOfPrevMonth),
      supabase
        .from("ai_usage")
        .select("feature, input_tokens, output_tokens, created_at")
        .gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true }),
    ]);

    const current = currentMonth.data || [];
    const prev = prevMonth.data || [];
    const daily = dailyBreakdown.data || [];

    const byFeature: Record<string, { requests: number; inputTokens: number; outputTokens: number; avgDuration: number }> = {};
    let totalInput = 0;
    let totalOutput = 0;
    let totalDuration = 0;

    for (const row of current) {
      const f = row.feature || "unknown";
      if (!byFeature[f]) byFeature[f] = { requests: 0, inputTokens: 0, outputTokens: 0, avgDuration: 0 };
      byFeature[f].requests += 1;
      byFeature[f].inputTokens += row.input_tokens || 0;
      byFeature[f].outputTokens += row.output_tokens || 0;
      byFeature[f].avgDuration += row.duration_ms || 0;
      totalInput += row.input_tokens || 0;
      totalOutput += row.output_tokens || 0;
      totalDuration += row.duration_ms || 0;
    }

    for (const f of Object.values(byFeature)) {
      if (f.requests > 0) f.avgDuration = Math.round(f.avgDuration / f.requests);
    }

    let prevInput = 0;
    let prevOutput = 0;
    for (const row of prev) {
      prevInput += row.input_tokens || 0;
      prevOutput += row.output_tokens || 0;
    }

    const costPerMInput = 3;
    const costPerMOutput = 15;
    const currentCost = (totalInput / 1_000_000) * costPerMInput + (totalOutput / 1_000_000) * costPerMOutput;
    const prevCost = (prevInput / 1_000_000) * costPerMInput + (prevOutput / 1_000_000) * costPerMOutput;

    const dailyMap: Record<string, { requests: number; tokens: number; cost: number }> = {};
    for (const row of daily) {
      const day = new Date(row.created_at).toISOString().split("T")[0];
      if (!dailyMap[day]) dailyMap[day] = { requests: 0, tokens: 0, cost: 0 };
      const inp = row.input_tokens || 0;
      const out = row.output_tokens || 0;
      dailyMap[day].requests += 1;
      dailyMap[day].tokens += inp + out;
      dailyMap[day].cost += (inp / 1_000_000) * costPerMInput + (out / 1_000_000) * costPerMOutput;
    }

    const dailyData = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        requests: d.requests,
        tokens: d.tokens,
        cost: Math.round(d.cost * 100) / 100,
      }));

    return NextResponse.json({
      success: true,
      data: {
        totalRequests: current.length,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        totalTokens: totalInput + totalOutput,
        estimatedCost: Math.round(currentCost * 100) / 100,
        prevMonthCost: Math.round(prevCost * 100) / 100,
        prevMonthRequests: prev.length,
        avgDuration: current.length > 0 ? Math.round(totalDuration / current.length) : 0,
        byFeature,
        daily: dailyData,
      },
    });
  } catch (err: any) {
    console.error("AI usage API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
