// app/api/strava/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/strava";
import { upsertUser } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // If the user denied access or there's no code, just go home.
  if (error || !code) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    // Exchange the one-time code from Strava for access/refresh tokens
    const tokens: any = await exchangeCodeForToken(code);
    const athlete = tokens.athlete;

    // Store or update this Strava athlete in our local "users" table
    await upsertUser({
      stravaAthleteId: athlete.id,
      name: `${athlete.firstname || ""} ${athlete.lastname || ""}`.trim(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_at,
    });

    // Back to the main dashboard
    return NextResponse.redirect(new URL("/", req.url));
  } catch (e) {
    console.error("Strava callback error:", e);
    // On error, redirect home with a simple flag
    const home = new URL("/", req.url);
    home.searchParams.set("auth", "failed");
    return NextResponse.redirect(home);
  }
}
