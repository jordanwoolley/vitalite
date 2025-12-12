// app/api/user/dob/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserById, upsertUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const userIdRaw = form.get("userId");
    const dobRaw = form.get("dob");

    const userId = Number(userIdRaw);
    const dob = typeof dobRaw === "string" ? dobRaw : "";

    if (!userIdRaw || Number.isNaN(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    // Expect YYYY-MM-DD from <input type="date">
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return NextResponse.json({ error: "Invalid dob" }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await upsertUser({ ...user, dob });

    // Redirect back to home (same pattern as your sync/delete)
    const back = new URL("/", req.url);
back.searchParams.set("noAutoSync", "1");
return NextResponse.redirect(back);


  } catch (err) {
    console.error("DOB update error:", err);
    return NextResponse.json({ error: "Failed to update dob" }, { status: 500 });
  }
}
