// app/api/user/dob/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loadDb, saveDb } from "@/lib/db";

function normalizeDob(input: string): string | null {
  const s = (input || "").trim();

  // YYYY-MM-DD (from <input type="date">)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY (tolerate)
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

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

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const userIdRaw = String(form.get("userId") ?? "");
  const dobRaw = String(form.get("dob") ?? "");

  const userId = Number(userIdRaw);
  if (!userIdRaw || Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const dob = normalizeDob(dobRaw);
  if (!dob) {
    return NextResponse.json({ error: "Invalid dob" }, { status: 400 });
  }

  const db = await loadDb();
  const idx = db.users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  db.users[idx] = { ...db.users[idx], dob };
  await saveDb(db);

  // ✅ Immediately sync current week once, so points appear right away
  const todayStr = formatDateUTC(new Date());
  const weekStartStr = formatDateUTC(getWeekStartUTC(todayStr));

  const syncUrl = new URL("/api/sync/week", req.url);
  syncUrl.searchParams.set("userId", String(userId));
  syncUrl.searchParams.set("weekStart", weekStartStr);

  return NextResponse.redirect(syncUrl);
}
