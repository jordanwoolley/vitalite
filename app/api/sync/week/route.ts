// app/api/sync/week/route.ts
import { NextRequest, NextResponse } from "next/server";
import { syncUserStravaWeek } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userIdRaw = url.searchParams.get("userId");
  const weekStart = url.searchParams.get("weekStart"); // YYYY-MM-DD (Monday)

  const userId = Number(userIdRaw);
  if (!userIdRaw || Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  }

  try {
    await syncUserStravaWeek(userId, weekStart);

    // send them back to the week they requested
    const back = new URL("/", req.url);
    back.searchParams.set("weekStart", weekStart);
    return NextResponse.redirect(back);
  } catch (err) {
    console.error("Week sync error:", err);
    return NextResponse.json({ error: "Failed to sync week" }, { status: 500 });
  }
}
