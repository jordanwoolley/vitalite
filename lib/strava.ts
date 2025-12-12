// lib/strava.ts
import "server-only";
import {
  getUserById,
  upsertDailyPoints,
  upsertUser,
  User,
  replaceUserActivitiesSince,
  Activity,
} from "./db";

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID!;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

// ✏️ Start date for counting points (inclusive)
export const START_DATE_STR = "2025-12-01"; // YYYY-MM-DD

/**
 * Calculate age from date of birth (YYYY-MM-DD format)
 */
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

/**
 * Calculate maximum heart rate based on age (220 - age)
 */
function calculateMaxHeartRate(age: number): number {
  return 220 - age;
}

/**
 * Calculate daily points based on new Vitality rules:
 * - Steps: 3 pts @ 7k, 5 pts @ 10k, 8 pts @ 12.5k
 * - Heart rate: 5 pts for 30+ min @ 60% maxHR, 8 pts for 60+ min @ 60% maxHR or 30+ min @ 70% maxHR
 * - Calories: 5 pts for 30+ min, 150+ kcal @ 300+ kcal/hr, 8 pts for 300+ kcal @ 600+ kcal/hr or 60+ min, 300+ kcal @ 300+ kcal/hr
 * Returns the maximum points earned from any method (capped at 8 per day)
 */
export function calculatePointsForDay(
  user: User,
  activities: Activity[],
  steps: number = 0
): number {
  let maxPoints = 0;

  // Steps-based points
  if (steps >= 12_500) maxPoints = Math.max(maxPoints, 8);
  else if (steps >= 10_000) maxPoints = Math.max(maxPoints, 5);
  else if (steps >= 7_000) maxPoints = Math.max(maxPoints, 3);

  // Need DOB for HR and calorie calculations
  if (!user.dob) {
    // If no DOB, can only use steps
    return maxPoints;
  }

  const age = calculateAge(user.dob);
  const maxHR = calculateMaxHeartRate(age);
  const hr60Threshold = maxHR * 0.6;
  const hr70Threshold = maxHR * 0.7;

  // Check each activity for HR and calorie-based points
  for (const activity of activities) {
    const mins = activity.movingMinutes;
    const avgHR = activity.averageHeartrate;
    const calories = activity.calories;

    // Heart rate-based points
    if (typeof avgHR === "number") {
      // 8 pts: 60+ min @ 60% maxHR
      if (mins >= 60 && avgHR >= hr60Threshold) {
        maxPoints = Math.max(maxPoints, 8);
      }
      // 8 pts: 30+ min @ 70% maxHR
      else if (mins >= 30 && avgHR >= hr70Threshold) {
        maxPoints = Math.max(maxPoints, 8);
      }
      // 5 pts: 30+ min @ 60% maxHR
      else if (mins >= 30 && avgHR >= hr60Threshold) {
        maxPoints = Math.max(maxPoints, 5);
      }
    }

    // Calorie-based points
    if (typeof calories === "number" && mins > 0) {
      const kcalPerHour = (calories / mins) * 60;

      // 8 pts: 300+ kcal @ 600+ kcal/hr
      if (calories >= 300 && kcalPerHour >= 600) {
        maxPoints = Math.max(maxPoints, 8);
      }
      // 8 pts: 60+ min, 300+ kcal total, @ 300+ kcal/hr
      else if (mins >= 60 && calories >= 300 && kcalPerHour >= 300) {
        maxPoints = Math.max(maxPoints, 8);
      }
      // 5 pts: 30+ min, 150+ kcal, @ 300+ kcal/hr
      else if (mins >= 30 && calories >= 150 && kcalPerHour >= 300) {
        maxPoints = Math.max(maxPoints, 5);
      }
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

export async function syncUserStrava(userId: number) {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const token = await getValidAccessToken(userId);

  // 👉 Pull the most recent 200 activities from Strava
  const resp = await fetch(
    "https://www.strava.com/api/v3/athlete/activities?per_page=200",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch activities: ${resp.status} ${text}`);
  }

  const activities = (await resp.json()) as any[];

  console.log("syncUserStrava", {
    userId,
    fetched: activities.length,
    sampleDates: activities.slice(0, 5).map(a => ({
      start_date_local: a.start_date_local,
      start_date: a.start_date,
    })),
  });
  

  const userActivities: Activity[] = [];

  const dates = userActivities.map(a => a.date).sort();
console.log("stored date range", { first: dates[0], last: dates[dates.length - 1] });


for (const a of activities) {
  const dayStr =
    typeof a.start_date_local === "string"
      ? a.start_date_local.slice(0, 10)
      : new Date(a.start_date).toISOString().slice(0, 10);

  if (dayStr < START_DATE_STR) continue;

    const movingMins = a.moving_time / 60;
    const distanceKm = a.distance ? a.distance / 1000 : 0;

    userActivities.push({
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
      calories: a.calories ?? (typeof a.kilojoules === "number" ? Math.round(a.kilojoules) : undefined),
    });
  }

  // Replace stored activities for this user from the start date onwards
  await replaceUserActivitiesSince(userId, START_DATE_STR, userActivities);

  // Group activities by day and calculate points using new scoring system
  const activitiesByDay: Record<string, Activity[]> = {};
  for (const activity of userActivities) {
    if (!activitiesByDay[activity.date]) {
      activitiesByDay[activity.date] = [];
    }
    activitiesByDay[activity.date].push(activity);
  }

  console.log("user scoring inputs", {
    hasDob: !!user.dob,
    anyAvgHr: userActivities.some(a => typeof a.averageHeartrate === "number"),
    anyCalories: userActivities.some(a => typeof a.calories === "number"),
  });
  

  // Calculate points for each day
  for (const [dayStr, dayActivities] of Object.entries(activitiesByDay)) {
    const workoutMinutes = Math.round(
      dayActivities.reduce((sum, a) => sum + a.movingMinutes, 0)
    );
    const steps = 0; // still 0 for now (until step source is integrated)
    const points = calculatePointsForDay(user, dayActivities, steps);

    await upsertDailyPoints({
      userId,
      date: dayStr,
      workoutMinutes,
      steps,
      points,
    });
  }
}
