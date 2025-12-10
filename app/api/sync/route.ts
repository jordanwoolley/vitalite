// app/api/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { syncUserStrava } from "@/lib/strava";

async function handleSync(req: NextRequest) {
  const url = new URL(req.url);
  let userIdParam = url.searchParams.get("userId");

  // If it's a POST and no query param, try JSON body too
  if (!userIdParam && req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.userId === "number") {
        userIdParam = String(body.userId);
      } else if (body && typeof body.userId === "string") {
        userIdParam = body.userId;
      }
    } catch {
      // ignore body parse errors; we'll fall back to validation below
    }
  }

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
    // after successful sync, go back to the main page
    return NextResponse.redirect(new URL("/", req.url));
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync Strava activities" },
      { status: 500 }
    );
  }
}

// Support both GET (for redirect) and POST (if you ever use fetch)
export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}
