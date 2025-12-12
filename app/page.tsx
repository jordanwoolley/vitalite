// app/page.tsx
import type React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getUsers,
  getRecentDailyPoints,
  getAllActivities,
} from "@/lib/db";
import { getStravaAuthorizeUrl, START_DATE_STR } from "@/lib/strava";
import UserSettings from "../components/UserSettings";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

type PageProps = {
  searchParams: Promise<SearchParams>;
};

const SESSION_COOKIE = "vitalite_user_id";

export default async function Home({ searchParams }: PageProps) {
  const sp = await searchParams;

  const userIdCookie = (await cookies()).get(SESSION_COOKIE)?.value;

  const users = await getUsers();
  const authUrl = getStravaAuthorizeUrl();

  // Determine the "active" user for this browser from the cookie
  const activeUser = userIdCookie
    ? users.find((u) => u.id === Number(userIdCookie))
    : undefined;

  // If no active user, show a simple landing page with a connect button
  if (!activeUser) {
    return (
      <main style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Vitalité</h1>
        <p style={{ marginTop: "1rem", marginBottom: "1rem" }}>
          Connect your Strava account to see your own daily Vitalité points.
        </p>
        <a
          href={authUrl}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: 4,
            border: "1px solid #333",
            fontSize: "0.9rem",
            textDecoration: "none",
          }}
        >
          + Connect Strava account
        </a>
      </main>
    );
  }

  // ✅ Option 1: require DOB to score (and avoid confusing 0-point weeks)
  if (!activeUser.dob) {
    return (
      <main style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.2rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Vitalité</h1>
          <div style={{ fontSize: "0.9rem" }}>
            Signed in as <strong>{activeUser.name || "Unknown user"}</strong>
          </div>
          {/* Only pass this single user into settings to preserve privacy */}
          <UserSettings users={[activeUser]} authUrl={authUrl} />
        </div>

        <section style={{ marginTop: "1rem" }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.1rem" }}>
            Add your date of birth to enable scoring
          </h2>
          <p style={{ color: "#555", fontSize: "0.95rem", marginTop: "0.5rem" }}>
            Vitalité uses your age to calculate heart-rate zones. Open Settings,
            add your DOB, then press <strong>Sync</strong> to compute points for
            this week.
          </p>
        </section>
      </main>
    );
  }

  // From here down we only care about this active user
  const allPoints = await getRecentDailyPoints(365);
  const activities = await getAllActivities();

  const userPoints = allPoints.filter((p) => p.userId === activeUser.id);
  const userActivities = activities.filter((a) => a.userId === activeUser.id);

  // --- determine which week we're looking at ---

  const weekParamRaw = sp?.weekStart;
  const weekParam =
    typeof weekParamRaw === "string"
      ? weekParamRaw
      : Array.isArray(weekParamRaw) && weekParamRaw.length
      ? weekParamRaw[0]
      : undefined;

  // If we have any points, default to the most recent week's Monday.
  // Otherwise default to START_DATE_STR's Monday.
  const latestDate =
    userPoints.length > 0
      ? userPoints
          .map((p) => p.date)
          .sort()
          .slice(-1)[0]
      : START_DATE_STR;

  const selectedWeekStart = weekParam
    ? getWeekStart(weekParam)
    : getWeekStart(latestDate);

  const weekStartStr = formatDate(selectedWeekStart);
  const weekEnd = addDays(selectedWeekStart, 6);
  const weekEndStr = formatDate(weekEnd);

  // filter points & activities for this week (active user only)
  const weekPoints = userPoints.filter(
    (p) => p.date >= weekStartStr && p.date <= weekEndStr
  );
  const weekActivities = userActivities.filter(
    (a) => a.date >= weekStartStr && a.date <= weekEndStr
  );

  // weekly totals (raw vs capped)
  const rawWeekTotal = weekPoints.reduce((sum, p) => sum + p.points, 0);
  const cappedWeekTotal = Math.min(40, rawWeekTotal);

  // daily totals for chart (ensure all 7 days present)
  const dayStrings = [...Array(7)].map((_, i) =>
    formatDate(addDays(selectedWeekStart, i))
  );

  const dailyValues = dayStrings.map((d) =>
    weekPoints
      .filter((p) => p.date === d)
      .reduce((sum, p) => sum + p.points, 0)
  );

  // Group activities by day for tooltips and icons
  const activitiesByDay = dayStrings.map((d) =>
    weekActivities.filter((a) => a.date === d)
  );

  const hasAnyPointsThisWeek = dailyValues.some((v) => v > 0);
  const maxPoints = dailyValues.length ? Math.max(...dailyValues, 8) : 8;

  // previous / next week links
  const prevWeekStartStr = formatDate(addDays(selectedWeekStart, -7));
  const nextWeekStartStr = formatDate(addDays(selectedWeekStart, 7));

  // Auto-sync check: if no activities from today for THIS user, trigger sync
  const todayStr = formatDate(new Date());
  const hasTodayActivities = userActivities.some((a) => a.date === todayStr);
  const shouldAutoSync =
    !!activeUser && !hasTodayActivities && !sp?.noAutoSync;

  if (shouldAutoSync) {
    redirect(`/api/sync?userId=${activeUser.id}`);
  }

  // ---- day of week helpers ----
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function getDayLabel(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    // Our week always starts with Monday, so
    // Mon=1=>0, Tue=2=>1, ..., Sun=0=>6
    const idx = (d.getDay() + 6) % 7;
    return DAY_LABELS[idx];
  }

  const dayLabels = dayStrings.map((d) => getDayLabel(d));

  return (
    <main style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Vitalité</h1>
        <div style={{ fontSize: "0.9rem" }}>
          Signed in as <strong>{activeUser.name || "Unknown user"}</strong>
        </div>
        {/* Only pass this single user into settings to preserve privacy */}
        <UserSettings users={[activeUser]} authUrl={authUrl} />
      </div>

      {/* Week header + nav + totals */}
      <section style={{ marginBottom: "1.2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
