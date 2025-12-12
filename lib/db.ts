// lib/db.ts
import fs from "fs";
import path from "path";
import { kv } from "@vercel/kv";

const DB_PATH = path.join(process.cwd(), "db.json");
const DB_KEY = "vitality:db";
const USE_KV = !!process.env.KV_URL;

export type User = {
  id: number;
  stravaAthleteId: number;
  name: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  dob?: string; // YYYY-MM-DD
};

export type DailyPoints = {
  userId: number;
  date: string; // YYYY-MM-DD
  workoutMinutes: number;
  steps: number;
  points: number;
};

export type Activity = {
  userId: number;
  stravaId: number;
  name: string;
  type: string;
  movingMinutes: number;
  distanceKm: number;
  startDateLocal: string;
  date: string; // YYYY-MM-DD
  averageHeartrate?: number;
  maxHeartrate?: number;
  calories?: number;
};

export type SyncedWeek = {
  userId: number;
  weekStart: string; // YYYY-MM-DD (Monday, UTC semantics)
  syncedAt: number;
};

type DbShape = {
  users: User[];
  dailyPoints: DailyPoints[];
  activities: Activity[];
  syncedWeeks: SyncedWeek[];
};

const EMPTY_DB: DbShape = {
  users: [],
  dailyPoints: [],
  activities: [],
  syncedWeeks: [],
};

/**
 * Load DB from Vercel KV or local file.
 * IMPORTANT: merges defaults so newly-added fields (e.g. syncedWeeks)
 * always exist even for old stored data.
 */
export async function loadDb(): Promise<DbShape> {
  if (USE_KV) {
    try {
      const data = await kv.get<Partial<DbShape>>(DB_KEY);

      return {
        ...EMPTY_DB,
        ...(data ?? {}),
        users: data?.users ?? [],
        dailyPoints: data?.dailyPoints ?? [],
        activities: data?.activities ?? [],
        syncedWeeks: (data as any)?.syncedWeeks ?? [],
      };
    } catch (error) {
      console.error("Error loading from KV:", error);
      return { ...EMPTY_DB };
    }
  }

  // ----- Local file fallback -----
  if (!fs.existsSync(DB_PATH)) {
    return { ...EMPTY_DB };
  }

  const raw = fs.readFileSync(DB_PATH, "utf8");
  const parsed = JSON.parse(raw);

  return {
    users: parsed.users ?? [],
    dailyPoints: parsed.dailyPoints ?? [],
    activities: parsed.activities ?? [],
    syncedWeeks: parsed.syncedWeeks ?? [],
  };
}

export async function saveDb(db: DbShape): Promise<void> {
  if (USE_KV) {
    await kv.set(DB_KEY, db);
  } else {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  }
}

// -------- Users --------

export async function getUsers(): Promise<User[]> {
  const db = await loadDb();
  return db.users;
}

export async function upsertUser(
  user: Omit<User, "id"> & { id?: number }
): Promise<User> {
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
  const db = await loadDb();
  return db.users.find((u) => u.id === userId);
}

// -------- Daily points --------

export async function upsertDailyPoints(entry: DailyPoints): Promise<void> {
  const db = await loadDb();
  const idx = db.dailyPoints.findIndex(
    (d) => d.userId === entry.userId && d.date === entry.date
  );
  if (idx >= 0) db.dailyPoints[idx] = entry;
  else db.dailyPoints.push(entry);
  await saveDb(db);
}

export async function getRecentDailyPoints(
  limitDays = 60
): Promise<DailyPoints[]> {
  const db = await loadDb();
  return db.dailyPoints
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limitDays);
}

// -------- Activities --------

export async function getAllActivities(): Promise<Activity[]> {
  const db = await loadDb();
  return db.activities;
}

/**
 * Upsert activities by (userId + stravaId).
 * Used by lazy week-by-week sync.
 */
export async function upsertActivities(
  newActivities: Activity[]
): Promise<void> {
  const db = await loadDb();

  for (const a of newActivities) {
    const idx = db.activities.findIndex(
      (x) => x.userId === a.userId && x.stravaId === a.stravaId
    );
    if (idx >= 0) {
      db.activities[idx] = { ...db.activities[idx], ...a };
    } else {
      db.activities.push(a);
    }
  }

  await saveDb(db);
}

// -------- Synced weeks (lazy sync tracking) --------

export async function isWeekSynced(
  userId: number,
  weekStart: string
): Promise<boolean> {
  const db = await loadDb();
  return db.syncedWeeks.some(
    (w) => w.userId === userId && w.weekStart === weekStart
  );
}

export async function markWeekSynced(
  userId: number,
  weekStart: string
): Promise<void> {
  const db = await loadDb();
  const idx = db.syncedWeeks.findIndex(
    (w) => w.userId === userId && w.weekStart === weekStart
  );

  const entry: SyncedWeek = {
    userId,
    weekStart,
    syncedAt: Date.now(),
  };

  if (idx >= 0) db.syncedWeeks[idx] = entry;
  else db.syncedWeeks.push(entry);

  await saveDb(db);
}

// -------- Single-user reset helper --------

export async function clearAllData(): Promise<void> {
  await saveDb({ ...EMPTY_DB });
}
