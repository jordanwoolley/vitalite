import type React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getUsers,
  getRecentDailyPoints,
  getAllActivities,
  isWeekSynced,
} from "@/lib/db";
import { getStravaAuthorizeUrl } from "@/lib/strava";
import UserSettings from "../components/UserSettings";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

type PageProps = {
  searchParams: Promise<SearchParams>;
};

const SESSION_COOKIE = "vitalite_user_id";

export default async function Home({ searchParams }: PageProps) {
  const sp = await searchParams;
  const syncError = sp?.syncError === "1";
  const noAutoSync = sp?.noAutoSync === "1";


  const userIdCookie = (await cookies()).get(SESSION_COOKIE)?.value;

  const users = await getUsers();
  const authUrl = getStravaAuthorizeUrl();

  const activeUser = userIdCookie
    ? users.find((u) => u.id === Number(userIdCookie))
    : undefined;

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

  // Require DOB (Option 1)
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
          <UserSettings users={[activeUser]} authUrl={authUrl} />
        </div>

        <section style={{ marginTop: "1rem" }}>
          <h2 style={{ fontWeight: 600, fontSize: "1.1rem" }}>
            Add your date of birth to enable scoring
          </h2>
          <p style={{ color: "#555", fontSize: "0.95rem", marginTop: "0.5rem" }}>
            Vitalité uses your age to calculate heart-rate zones. Open Settings,
            add your DOB, then press <strong>Sync</strong> to compute points.
          </p>
        </section>
      </main>
    );
  }

  // Determine which week we're looking at
  const weekParamRaw = sp?.weekStart;
  const weekParam =
    typeof weekParamRaw === "string"
      ? weekParamRaw
      : Array.isArray(weekParamRaw) && weekParamRaw.length
      ? weekParamRaw[0]
      : undefined;

  // Default: this week
  const defaultWeekStart = getWeekStart(formatDate(new Date()));
  const selectedWeekStart = weekParam ? getWeekStart(weekParam) : defaultWeekStart;

  const weekStartStr = formatDate(selectedWeekStart);
  const weekEnd = addDays(selectedWeekStart, 6);
  const weekEndStr = formatDate(weekEnd);

  // "This week" UI logic
  const thisWeekStart = getWeekStart(formatDate(new Date()));
  const isViewingThisWeek =
    formatDate(selectedWeekStart) === formatDate(thisWeekStart);

  // ✅ Lazy sync: only sync the week when it’s viewed
  const isCurrentWeek = isViewingThisWeek;

  const weekAlreadySynced = await isWeekSynced(activeUser.id, weekStartStr);

// ✅ refresh current week always (unless noAutoSync or syncError)
const shouldSyncThisWeek =
  !noAutoSync &&
  !syncError &&
  (isViewingThisWeek || !weekAlreadySynced);

if (shouldSyncThisWeek) {
  redirect(`/api/sync/week?userId=${activeUser.id}&weekStart=${weekStartStr}`);
}


  // Read from DB
  const allPoints = await getRecentDailyPoints(365);
  const activities = await getAllActivities();

  const userPoints = allPoints.filter((p) => p.userId === activeUser.id);
  const userActivities = activities.filter((a) => a.userId === activeUser.id);

  const weekPoints = userPoints.filter(
    (p) => p.date >= weekStartStr && p.date <= weekEndStr
  );
  const weekActivities = userActivities.filter(
    (a) => a.date >= weekStartStr && a.date <= weekEndStr
  );

  const rawWeekTotal = weekPoints.reduce((sum, p) => sum + p.points, 0);
  const cappedWeekTotal = Math.min(40, rawWeekTotal);

  const dayStrings = [...Array(7)].map((_, i) =>
    formatDate(addDays(selectedWeekStart, i))
  );

  const dailyValues = dayStrings.map((d) =>
    weekPoints.filter((p) => p.date === d).reduce((sum, p) => sum + p.points, 0)
  );

  const activitiesByDay = dayStrings.map((d) =>
    weekActivities.filter((a) => a.date === d)
  );

  const hasAnyPointsThisWeek = dailyValues.some((v) => v > 0);
  const maxPoints = dailyValues.length ? Math.max(...dailyValues, 8) : 8;

  const prevWeekStartStr = formatDate(addDays(selectedWeekStart, -7));
  const nextWeekStartStr = formatDate(addDays(selectedWeekStart, 7));

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function getDayLabel(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
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
        <UserSettings users={[activeUser]} authUrl={authUrl} />
      </div>

      {syncError && (
        <div
          style={{
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
            color: "#842029",
            padding: "0.6rem 0.8rem",
            borderRadius: 6,
            marginBottom: "0.75rem",
            fontSize: "0.9rem",
          }}
        >
          Sync failed. Please try again in a moment (or hit Sync in Settings).
        </div>
      )}

      <section style={{ marginBottom: "1.2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.4rem",
            flexWrap: "wrap",
          }}
        >
          <a
            href={`/?weekStart=${prevWeekStartStr}`}
            style={{ textDecoration: "none", fontSize: "1.2rem" }}
          >
            ←
          </a>

          <div>
            <div style={{ fontWeight: 500 }}>
              Week {weekStartStr} – {weekEndStr}
            </div>
            {!isViewingThisWeek && (
              <a
                href="/"
                style={{
                  fontSize: "0.8rem",
                  color: "#4a90e2",
                  textDecoration: "none",
                }}
              >
                Back to current week
              </a>
            )}
          </div>

          <a
            href={`/?weekStart=${nextWeekStartStr}`}
            style={{ textDecoration: "none", fontSize: "1.2rem" }}
          >
            →
          </a>
        </div>

        <div style={{ fontSize: "0.9rem" }}>
          Weekly total: <strong>{cappedWeekTotal} / 40</strong> points{" "}
          {rawWeekTotal > 40 && (
            <span style={{ color: "#b00" }}>
              (raw {rawWeekTotal} capped at 40)
            </span>
          )}
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 500, marginBottom: "0.4rem" }}>
          Progress this week
        </h2>
        <PieChart current={cappedWeekTotal} max={40} />
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 500, marginBottom: "0.4rem" }}>
          Points per day (this week)
        </h2>
        {!hasAnyPointsThisWeek ? (
          <p style={{ fontSize: "0.9rem", color: "#555" }}>
            No points recorded in this week yet.
          </p>
        ) : (
          <div style={{ border: "1px solid #eee", padding: "0.75rem" }}>
            <DailyChart
              labels={dayLabels}
              values={dailyValues}
              maxPoints={maxPoints}
              activitiesByDay={activitiesByDay}
            />
          </div>
        )}
      </section>
    </main>
  );
}

// --- charts (unchanged) ---

function DailyChart({
  labels,
  values,
  maxPoints,
  activitiesByDay,
}: {
  labels: string[];
  values: number[];
  maxPoints: number;
  activitiesByDay: any[][];
}) {
  const width = Math.max(40 * labels.length + 20, 260);
  const height = 140;
  const chartHeight = 100;
  const barWidth = 24;
  const gap = 16;

  const runIconPath =
    "M216-580q39 0 74 14t64 41l382 365h24q17 0 28.5-11.5T800-200q0-8-1.5-17T788-235L605-418l-71-214-74 18q-38 10-69-14t-31-63v-84l-28-14-154 206q-1 1-1 1.5t-1 1.5h40Zm0 80h-46q3 7 7.5 13t10.5 11l324 295q11 11 25 16t29 5h54L299-467q-17-17-38.5-25t-44.5-8ZM566-80q-30 0-57-11t-50-31L134-417q-46-42-51.5-103T114-631l154-206q17-23 45.5-30.5T368-861l28 14q21 11 32.5 30t11.5 42v84l74-19q30-8 58 7.5t38 44.5l65 196 170 170q20 20 27.5 43t7.5 49q0 50-35 85t-85 35H566Z";

  const workoutIconPath =
    "m826-585-56-56 30-31-128-128-31 30-57-57 30-31q23-23 57-22.5t57 23.5l129 129q23 23 23 56.5T857-615l-31 30ZM346-104q-23 23-56.5 23T233-104L104-233q-23-23-23-56.5t23-56.5l30-30 57 57-31 30 129 129 30-31 57 57-30 30Zm397-336 57-57-303-303-57 57 303 303ZM463-160l57-58-302-302-58 57 303 303Zm-6-234 110-109-64-64-109 110 63 63Zm63 290q-23 23-57 23t-57-23L104-406q-23-23-23-57t23-57l57-57q23-23 56.5-23t56.5 23l63 63 110-110-63-62q-23-23-23-57t23-57l57-57q23-23 56.5-23t56.5 23l303 303q23 23 23 56.5T857-441l-57 57q-23 23-57 23t-57-23l-62-63-110 110 63 63q23 23 23 56.5T577-161l-57 57Z";

  const getActivityType = (activities: any[]) => {
    if (activities.length === 0) return null;
    const types = activities.map((a) => a.type?.toLowerCase() || "");
    if (types.some((t) => t.includes("run"))) return "run";
    return "workout";
  };

  const getTooltipText = (activities: any[]) => {
    if (activities.length === 0) return "";
    return activities
      .map((a) => {
        const parts = [
          a.type || "Activity",
          a.name || "",
          `${a.movingMinutes} mins`,
          a.distanceKm ? `${a.distanceKm} km` : "",
          typeof a.averageHeartrate === "number" ? `avg HR ${a.averageHeartrate}` : "",
          typeof a.maxHeartrate === "number" ? `max HR ${a.maxHeartrate}` : "",
          typeof a.calories === "number" ? `${a.calories} cal` : "",
        ]
          .filter(Boolean)
          .join(" • ");
        return parts;
      })
      .join("\n");
  };

  return (
    <svg width={width} height={height}>
      <line
        x1={10}
        y1={height - 25}
        x2={width - 10}
        y2={height - 25}
        stroke="#ccc"
        strokeWidth={1}
      />
      {labels.map((label, i) => {
        const v = values[i];
        const barHeight = maxPoints ? (v / maxPoints) * chartHeight : 0;
        const x = 10 + i * (barWidth + gap);
        const y = height - 25 - barHeight;
        const dayActivities = activitiesByDay[i] || [];
        const activityType = getActivityType(dayActivities);
        const tooltipText = getTooltipText(dayActivities);

        return (
          <g key={label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill="#4a90e2">
              {tooltipText && <title>{tooltipText}</title>}
            </rect>
            {activityType && v > 0 && (
              <g
                transform={`translate(${x + barWidth / 2 - 8}, ${Math.max(
                  y + barHeight / 2 - 8,
                  y + 2
                )})`}
              >
                <svg width="16" height="16" viewBox="0 -960 960 960" fill="#fff" opacity="0.9">
                  <path d={activityType === "run" ? runIconPath : workoutIconPath} />
                </svg>
              </g>
            )}
            <text x={x + barWidth / 2} y={height - 10} fontSize="8" textAnchor="middle">
              {label}
            </text>
            <text x={x + barWidth / 2} y={y - 4} fontSize="8" textAnchor="middle" fill="#333">
              {v}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ current, max }: { current: number; max: number }) {
  const pct = Math.min(current / max, 1);
  const r = 52;
  const cx = 64;
  const cy = 64;
  const stroke = 12;
  const circumference = 2 * Math.PI * r;
  const progress = pct * circumference;

  return (
    <svg width={128} height={128}>
      <circle cx={cx} cy={cy} r={r} fill="#f6f8fa" stroke="#eee" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#4a90e2"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 7} textAnchor="middle" fontSize="1.5rem" fill="#222" fontFamily="inherit">
        {current}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fontSize="0.95rem" fill="#555" fontFamily="inherit">
        / {max}
      </text>
    </svg>
  );
}

// ---- date helpers ----

function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  return addDays(d, -diffToMonday);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
