// app/api/sync/week/route.ts
import { NextRequest, NextResponse } from "next/server";
import { syncUserStravaWeek } from "@/lib/strava";

async function handle(req: NextRequest) {
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
    back.searchParams.set("synced", "1");
    back.searchParams.set("noAutoSync", "1");
    return NextResponse.redirect(back);
  } catch (err: any) {
    console.error("Week sync error:", {
      userId,
      weekStart,
      message: err?.message,
      stack: err?.stack,
    });

    const back = new URL("/", req.url);
    back.searchParams.set("weekStart", weekStart);
    back.searchParams.set("syncError", "1");
    back.searchParams.set("noAutoSync", "1");
    return NextResponse.redirect(back);
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

// Optional: allows calling it from forms/fetch as POST too
export async function POST(req: NextRequest) {
  return handle(req);
}
