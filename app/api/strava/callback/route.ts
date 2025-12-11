// app/api/strava/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/strava";
import { upsertUser } from "@/lib/db";

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

    // upsertUser should RETURN the saved User, including its id 🔑
    const user = await upsertUser({
      stravaAthleteId: athlete.id,
      name: `${athlete.firstname || ""} ${athlete.lastname || ""}`.trim(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_at,
    });

    // Redirect back to home, with a cookie tying this browser to that user 🔑
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(SESSION_COOKIE, String(user.id), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return res;
  } catch (e) {
    console.error("Strava callback error:", e);
    const home = new URL("/", req.url);
    home.searchParams.set("auth", "failed");
    return NextResponse.redirect(home);
  }
}
