import "server-only";
import {
  getUserById,
  upsertDailyPoints,
  upsertUser,
  upsertActivities,
  markWeekSynced,
  User,
  Activity,
} from "./db";

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID!;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

function calculateAge(dob: string): number {
  const [year, month, day] = dob.split("-").map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateMaxHeartRate(age: number): number {
  return 220 - age;
}

export function calculatePointsForDay(
  user: User,
  activities: Activity[],
  steps: number = 0
): number {
  let maxPoints = 0;

  if (steps >= 12_500) maxPoints = Math.max(maxPoints, 8);
  else if (steps >= 10_000) maxPoints = Math.max(maxPoints, 5);
  else if (steps >= 7_000) maxPoints = Math.max(maxPoints, 3);

  if (!user.dob) return maxPoints;

  const age = calculateAge(user.dob);
  const maxHR = calculateMaxHeartRate(age);
  const hr60Threshold = maxHR * 0.6;
  const hr70Threshold = maxHR * 0.7;

  for (const activity of activities) {
    const mins = activity.movingMinutes;
    const avgHR = activity.averageHeartrate;
    const calories = activity.calories;

    if (typeof avgHR === "number") {
      if (mins >= 60 && avgHR >= hr60Threshold) maxPoints = Math.max(maxPoints, 8);
      else if (mins >= 30 && avgHR >= hr70Threshold) maxPoints = Math.max(maxPoints, 8);
      else if (mins >= 30 && avgHR >= hr60Threshold) maxPoints = Math.max(maxPoints, 5);
    }

    if (typeof calories === "number" && mins > 0) {
      const kcalPerHour = (calories / mins) * 60;

      if (calories >= 300 && kcalPerHour >= 600) maxPoints = Math.max(maxPoints, 8);
      else if (mins >= 60 && calories >= 300 && kcalPerHour >= 300) maxPoints = Math.max(maxPoints, 8);
      else if (mins >= 30 && calories >= 150 && kcalPerHour >= 300) maxPoints = Math.max(maxPoints, 5);
    }
  }

  return Math.min(8, maxPoints);
}

export function getStravaAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${BASE_URL}/api/strava/callback`,
    scope: "read,activity:read_all",
    approval_prompt: "auto",
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} ${text}`);
  }

  return (await resp.json()) as any;
}

export async function refreshToken(user: User) {
  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: user.refreshToken,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token refresh failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as any;
  const updated = await upsertUser({
    ...user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_at,
  });
  return updated;
}

export async function getValidAccessToken(userId: number) {
  let user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  const now = Math.floor(Date.now() / 1000);
  if (now < user.tokenExpiresAt - 60) return user.accessToken;
  user = await refreshToken(user);
  return user.accessToken;
}

/**
 * Lazy sync: fetch Strava activities ONLY for the requested week (UTC window),
 * upsert them into DB, and compute points for that week.
 */
export async function syncUserStravaWeek(userId: number, weekStartStr: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const token = await getValidAccessToken(userId);

  // UTC window [weekStart, nextWeekStart)
  const weekStart = new Date(`${weekStartStr}T00:00:00Z`);
  if (Number.isNaN(weekStart.getTime())) throw new Error("Invalid weekStartStr");

  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);

  const after = Math.floor(weekStart.getTime() / 1000);
  const before = Math.floor(nextWeekStart.getTime() / 1000);

  const resp = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch activities: ${resp.status} ${text}`);
  }

  const activities = (await resp.json()) as any[];

  const userActivities: Activity[] = activities.map((a) => {
    // safest local day string
    const dayStr =
      typeof a.start_date_local === "string"
        ? a.start_date_local.slice(0, 10)
        : new Date(a.start_date).toISOString().slice(0, 10);

    const movingMins = a.moving_time / 60;
    const distanceKm = a.distance ? a.distance / 1000 : 0;

    return {
      userId,
      stravaId: a.id,
      name: a.name,
      type: a.type,
      movingMinutes: Math.round(movingMins),
      distanceKm: Math.round(distanceKm * 10) / 10,
      startDateLocal: a.start_date_local,
      date: dayStr,
      averageHeartrate: a.average_heartrate ?? undefined,
      maxHeartrate: a.max_heartrate ?? undefined,
      calories:
        a.calories ??
        (typeof a.kilojoules === "number" ? Math.round(a.kilojoules) : undefined),
    };
  });

  // Upsert just these week activities
  await upsertActivities(userActivities);

  // Group by day (YYYY-MM-DD) and compute points for the week only
  const activitiesByDay: Record<string, Activity[]> = {};
  for (const a of userActivities) {
    if (!activitiesByDay[a.date]) activitiesByDay[a.date] = [];
    activitiesByDay[a.date].push(a);
  }

  // Compute for each day that had activities in that week
  for (const [dayStr, dayActivities] of Object.entries(activitiesByDay)) {
    const workoutMinutes = Math.round(dayActivities.reduce((sum, x) => sum + x.movingMinutes, 0));
    const steps = 0;
    const points = calculatePointsForDay(user, dayActivities, steps);

    await upsertDailyPoints({
      userId,
      date: dayStr,
      workoutMinutes,
      steps,
      points,
    });
  }

  await markWeekSynced(userId, weekStartStr);

  return {
    fetched: activities.length,
    upserted: userActivities.length,
    weekStart: weekStartStr,
  };
}
