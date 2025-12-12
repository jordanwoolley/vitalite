// app/api/strava/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/strava";
import { upsertUser, clearAllData } from "@/lib/db";

const SESSION_COOKIE = "vitalite_user_id";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const tokens: any = await exchangeCodeForToken(code);
    const athlete = tokens.athlete;

    // ✅ Single-user mode: wipe existing data before creating the new user
    await clearAllData();

    const user = await upsertUser({
      stravaAthleteId: athlete.id,
      name: `${athlete.firstname || ""} ${athlete.lastname || ""}`.trim(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_at,
    });

    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(SESSION_COOKIE, String(user.id), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (e) {
    console.error("Strava callback error:", e);
    const home = new URL("/", req.url);
    home.searchParams.set("auth", "failed");
    return NextResponse.redirect(home);
  }
}
