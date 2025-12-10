import { NextRequest, NextResponse } from "next/server";
import { getUserById, loadDb, saveDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const userIdStr = url.searchParams.get("userId");
  const userId = userIdStr ? parseInt(userIdStr, 10) : NaN;

  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Load DB, remove user and all their data
  const db = await loadDb();

  db.users = db.users.filter((u: any) => u.id !== userId);
  db.dailyPoints = db.dailyPoints.filter((p: any) => p.userId !== userId);
  db.activities = db.activities.filter((a: any) => a.userId !== userId);

  await saveDb(db);

  return NextResponse.redirect(new URL("/", req.url));
}

