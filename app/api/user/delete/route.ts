// app/api/user/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserById, loadDb, saveDb } from "@/lib/db";

export async function POST(req: NextRequest) {
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

  // ✅ Preserve the user row + DOB
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

  // ❌ Remove activity + scoring data only
  db.activities = db.activities.filter((a) => a.userId !== userId);
  db.dailyPoints = db.dailyPoints.filter((p) => p.userId !== userId);

  // ❌ Clear synced-week cache for this user
  if ("syncedWeeks" in db) {
    db.syncedWeeks = db.syncedWeeks.filter((w: any) => w.userId !== userId);
  }

  await saveDb(db);

  return NextResponse.redirect(new URL("/", req.url));
}
