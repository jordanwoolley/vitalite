// lib/db.ts
import fs from "fs";
import path from "path";
import { kv } from "@vercel/kv";

const DB_PATH = path.join(process.cwd(), "db.json");
const DB_KEY = "vitality:db"; // Key for Vercel KV storage
const USE_KV = !!process.env.KV_URL; // Use KV if KV_URL is set (Vercel), otherwise use local file

export type User = {
  id: number;
  stravaAthleteId: number;
  name: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  /**
   * Date of birth as YYYY-MM-DD. Required for age-based points. Optional for legacy users.
   */
  dob?: string;
};

export type DailyPoints = {
  userId: number;
  date: string; // YYYY-MM-DD
  workoutMinutes: number;
  steps: number;
  points: number; // "raw" points for that day
};

export type Activity = {
  userId: number;
  stravaId: number;
  name: string;
  type: string;
  movingMinutes: number;
  distanceKm: number;
  startDateLocal: string; // full ISO
  date: string; // YYYY-MM-DD (local day)
  averageHeartrate?: number;
  maxHeartrate?: number;
  calories?: number;
};

type DbShape = {
  users: User[];
  dailyPoints: DailyPoints[];
  activities: Activity[];
};

export async function loadDb(): Promise<DbShape> {
  if (USE_KV) {
    try {
      const data = await kv.get<DbShape>(DB_KEY);
      return data || { users: [], dailyPoints: [], activities: [] };
    } catch (error) {
      console.error("Error loading from KV:", error);
      return { users: [], dailyPoints: [], activities: [] };
    }
  } else {
    // Local file fallback for development
    if (!fs.existsSync(DB_PATH)) {
      return { users: [], dailyPoints: [], activities: [] };
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);

    return {
      users: parsed.users ?? [],
      dailyPoints: parsed.dailyPoints ?? [],
      activities: parsed.activities ?? [],
    };
  }
}

export async function saveDb(db: DbShape): Promise<void> {
  if (USE_KV) {
    try {
      await kv.set(DB_KEY, db);
    } catch (error) {
      console.error("Error saving to KV:", error);
      throw error;
    }
  } else {
    // Local file fallback for development
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  }
}

export async function getUsers(): Promise<User[]> {
  const db = await loadDb();
  return db.users;
}

export async function upsertUser(user: Omit<User, "id"> & { id?: number }): Promise<User> {
  const db = await loadDb();
  const existingIndex = db.users.findIndex(
    (u) => u.stravaAthleteId === user.stravaAthleteId
  );
  let finalUser: User;

  if (existingIndex >= 0) {
    finalUser = {
      ...db.users[existingIndex],
      ...user,
      id: db.users[existingIndex].id,
    };
    db.users[existingIndex] = finalUser;
  } else {
    const newId = db.users.length
      ? Math.max(...db.users.map((u) => u.id)) + 1
      : 1;
    finalUser = { ...user, id: newId } as User;
    db.users.push(finalUser);
  }

  await saveDb(db);
  return finalUser;
}

export async function getUserById(userId: number): Promise<User | undefined> {
  const users = await getUsers();
  return users.find((u) => u.id === userId);
}

export async function upsertDailyPoints(entry: DailyPoints): Promise<void> {
  const db = await loadDb();
  const idx = db.dailyPoints.findIndex(
    (d) => d.userId === entry.userId && d.date === entry.date
  );
  if (idx >= 0) {
    db.dailyPoints[idx] = entry;
  } else {
    db.dailyPoints.push(entry);
  }
  await saveDb(db);
}

export async function getRecentDailyPoints(limitDays = 60): Promise<DailyPoints[]> {
  const db = await loadDb();
  return db.dailyPoints
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limitDays);
}

// -------- Activities helpers --------

export async function replaceUserActivitiesSince(
  userId: number,
  startDate: string, // YYYY-MM-DD inclusive
  newActivities: Activity[]
): Promise<void> {
  const db = await loadDb();
  db.activities = db.activities.filter(
    (a) => !(a.userId === userId && a.date >= startDate)
  );
  db.activities.push(...newActivities);
  await saveDb(db);
}

export async function getAllActivities(): Promise<Activity[]> {
  const db = await loadDb();
  return db.activities;
}
