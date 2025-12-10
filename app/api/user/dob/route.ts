import { NextRequest, NextResponse } from "next/server";
import { getUserById, upsertUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { userId, dob } = await req.json();
  if (!userId || !dob) return NextResponse.json({ error: "Missing userId or dob" }, { status: 400 });
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  // Shallow merge with existing user
  const updated = await upsertUser({ ...user, dob });
  return NextResponse.json({ user: updated });
}
