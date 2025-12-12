// app/api/user/dob/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loadDb, saveDb } from "@/lib/db";

function normalizeDob(input: string): string | null {
  // Accept "YYYY-MM-DD" (from <input type="date">), and tolerate "MM/DD/YYYY"
  const s = (input || "").trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
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

  // Prevent the lazy week-sync redirect immediately after saving DOB
  const back = new URL("/", req.url);
  back.searchParams.set("noAutoSync", "1");
  return NextResponse.redirect(back);
}
