// app/api/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { syncUserStravaWeek } from "@/lib/strava";

function formatDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUTC(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function getWeekStartUTC(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  return addDaysUTC(d, -diffToMonday);
}

async function handleSync(req: NextRequest) {
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");

  if (!userIdParam) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const userId = Number(userIdParam);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const thisWeekStartStr = formatDateUTC(getWeekStartUTC(formatDateUTC(new Date())));

  await syncUserStravaWeek(userId, thisWeekStartStr);
  return NextResponse.redirect(new URL("/", req.url));
}

export async function GET(req: NextRequest) {
  return handleSync(req);
}
export async function POST(req: NextRequest) {
  return handleSync(req);
}
