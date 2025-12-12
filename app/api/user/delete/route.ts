// app/api/user/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserById, loadDb, saveDb } from "@/lib/db";

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const userIdStr = url.searchParams.get("userId");
  const userId = userIdStr ? Number(userIdStr) : NaN;

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const db = await loadDb();

  // ✅ Keep user + DOB, clear tokens
  db.users = db.users.map((u) =>
    u.id === userId
      ? {
          ...u,
          accessToken: "",
          refreshToken: "",
          tokenExpiresAt: 0,
        }
      : u
  );

  // ✅ Remove activities/points for this user
  db.activities = db.activities.filter((a) => a.userId !== userId);
  db.dailyPoints = db.dailyPoints.filter((p) => p.userId !== userId);

  // ✅ Clear week-cache if present
  if ((db as any).syncedWeeks) {
    (db as any).syncedWeeks = (db as any).syncedWeeks.filter(
      (w: any) => w.userId !== userId
    );
  }

  await saveDb(db);

  // ✅ Also clear the browser cookie so you aren't "signed in" to a disconnected user
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("vitalite_user_id", "", {
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// Handy if a browser ever hits it as GET (prevents 405)
export async function GET(req: NextRequest) {
  return handle(req);
}
