// app/api/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { syncUserStrava } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");

  if (!userIdParam) {
    return NextResponse.json(
      { error: "Missing userId" },
      { status: 400 }
    );
  }

  const userId = Number(userIdParam);
  if (Number.isNaN(userId)) {
    return NextResponse.json(
      { error: "Invalid userId" },
      { status: 400 }
    );
  }

  try {
    await syncUserStrava(userId);
    // after sync, go back to the main page
    return NextResponse.redirect(new URL("/", req.url));
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync Strava activities" },
      { status: 500 }
    );
  }
}