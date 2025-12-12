// app/api/sync/week/route.ts
import { NextRequest, NextResponse } from "next/server";
import { syncUserStravaWeek } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userIdRaw = url.searchParams.get("userId");
  const weekStart = url.searchParams.get("weekStart"); // YYYY-MM-DD

  const userId = Number(userIdRaw);
  if (!userIdRaw || Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  }

  try {
    await syncUserStravaWeek(userId, weekStart);

    const back = new URL("/", req.url);
    back.searchParams.set("weekStart", weekStart);
    return NextResponse.redirect(back);
  } catch (err: any) {
    // ✅ This is what you should look at in Vercel Logs
    console.error("Week sync error:", {
      userId,
      weekStart,
      message: err?.message,
      stack: err?.stack,
    });

    // ✅ Don’t strand the user on /api/sync/week
    const back = new URL("/", req.url);
    back.searchParams.set("weekStart", weekStart);
    back.searchParams.set("syncError", "1");
    return NextResponse.redirect(back);
  }
}
