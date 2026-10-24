/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'node:path';
import fs from 'node:fs';
import { HangoutPreferences, Friend, ActivityCategory } from '@/types';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'txmates.db');
const JSON_DB_PATH = path.join(DB_DIR, 'txmates.json');

// Dynamically check for node:sqlite support (introduced in Node.js v22.5.0)
// For Node 20 environments, provide a zero-dependency JSON file store fallback.
let DatabaseSyncClass: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeSqlite = require('node:sqlite');
  DatabaseSyncClass = nodeSqlite.DatabaseSync;
} catch {
  DatabaseSyncClass = null;
}

let dbInstance: any = null;

export function getDb(): any {
  if (!DatabaseSyncClass) return null;

  if (!dbInstance) {
    dbInstance = new DatabaseSyncClass(DB_PATH);
    dbInstance.exec('PRAGMA journal_mode = WAL;');

    // Initialize SQL tables
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS hangouts (
        id TEXT PRIMARY KEY,
        group_name TEXT NOT NULL,
        location TEXT NOT NULL,
        date TEXT NOT NULL,
        time_preference TEXT NOT NULL,
        max_budget INTEGER NOT NULL,
        selected_interests TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS friend_availabilities (
        id TEXT PRIMARY KEY,
        hangout_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        friend_name TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        budget_preference INTEGER,
        top_interests TEXT,
        status TEXT DEFAULT 'pending',
        submitted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hangout_id) REFERENCES hangouts(id) ON DELETE CASCADE,
        UNIQUE (hangout_id, friend_id)
      );
    `);
  }
  return dbInstance;
}

interface HangoutRow {
  id: string;
  group_name: string;
  location: string;
  date: string;
  time_preference: 'afternoon' | 'evening' | 'all-day' | 'night';
  max_budget: number;
  selected_interests: string;
  created_at: string;
  updated_at: string;
}

interface FriendRow {
  id: string;
  hangout_id: string;
  friend_id: string;
  friend_name: string;
  avatar_color: string;
  start_time: string;
  end_time: string;
  budget_preference: number | null;
  top_interests: string | null;
  status: 'pending' | 'submitted';
  submitted_at: string | null;
}

function getDefaultHangout(hangoutId: string): HangoutPreferences {
  return {
    id: hangoutId,
    groupName: 'The goobers',
    location: 'Austin, TX',
    date: '2026-10-26',
    timePreference: 'afternoon',
    maxBudgetPerPerson: 50,
    selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
    friendCount: 4,
    friends: [
      {
        id: 'f-1',
        name: 'Alex (Organizer)',
        avatarColor: 'bg-teal-600 text-white',
        availabilitySlots: [{ id: 's-1', startTime: '13:00', endTime: '21:00' }],
        budgetPreference: 50,
        topInterests: ['food', 'music'],
      },
      {
        id: 'f-2',
        name: 'Sam M.',
        avatarColor: 'bg-sky-600 text-white',
        availabilitySlots: [{ id: 's-2', startTime: '14:30', endTime: '20:30' }],
        budgetPreference: 40,
        topInterests: ['outdoors', 'food'],
      },
      {
        id: 'f-3',
        name: 'Jordan K.',
        avatarColor: 'bg-amber-600 text-white',
        availabilitySlots: [{ id: 's-3', startTime: '15:00', endTime: '22:00' }],
        budgetPreference: 65,
        topInterests: ['gaming', 'music'],
      },
      {
        id: 'f-4',
        name: 'Taylor R.',
        avatarColor: 'bg-emerald-600 text-white',
        availabilitySlots: [{ id: 's-4', startTime: '14:00', endTime: '21:30' }],
        budgetPreference: 45,
        topInterests: ['food', 'arts'],
      },
    ],
  };
}

// Fallback JSON-file store operations for Node 20
function readJsonDb(): Record<string, HangoutPreferences> {
  try {
    if (fs.existsSync(JSON_DB_PATH)) {
      const data = fs.readFileSync(JSON_DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Ignore and return empty store
  }
  return {};
}

function writeJsonDb(store: Record<string, HangoutPreferences>) {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

export function saveHangoutToDb(hangout: HangoutPreferences): string {
  const db = getDb();
  const id = hangout.id || 'txmates-demo';

  if (!db) {
    const store = readJsonDb();
    store[id] = { ...hangout, id };
    writeJsonDb(store);
    return id;
  }

  const upsertHangout = db.prepare(`
    INSERT INTO hangouts (id, group_name, location, date, time_preference, max_budget, selected_interests, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      group_name = excluded.group_name,
      location = excluded.location,
      date = excluded.date,
      time_preference = excluded.time_preference,
      max_budget = excluded.max_budget,
      selected_interests = excluded.selected_interests,
      updated_at = CURRENT_TIMESTAMP
  `);

  upsertHangout.run(
    id,
    hangout.groupName,
    hangout.location,
    hangout.date,
    hangout.timePreference,
    hangout.maxBudgetPerPerson,
    JSON.stringify(hangout.selectedInterests)
  );

  const upsertFriend = db.prepare(`
    INSERT INTO friend_availabilities (
      id, hangout_id, friend_id, friend_name, avatar_color,
      start_time, end_time, budget_preference, top_interests, status, submitted_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hangout_id, friend_id) DO UPDATE SET
      friend_name = excluded.friend_name,
      avatar_color = excluded.avatar_color,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      budget_preference = coalesce(excluded.budget_preference, friend_availabilities.budget_preference),
      top_interests = coalesce(excluded.top_interests, friend_availabilities.top_interests),
      status = CASE WHEN friend_availabilities.status = 'submitted' THEN 'submitted' ELSE excluded.status END
  `);

  hangout.friends.forEach((f) => {
    const slot = f.availabilitySlots[0] || { startTime: '14:00', endTime: '20:00' };
    const rowId = `${id}_${f.id}`;
    upsertFriend.run(
      rowId,
      id,
      f.id,
      f.name,
      f.avatarColor,
      slot.startTime,
      slot.endTime,
      f.budgetPreference || null,
      f.topInterests ? JSON.stringify(f.topInterests) : null,
      f.status || 'pending',
      f.submittedAt || null
    );
  });

  return id;
}

export function getHangoutFromDb(hangoutId: string): HangoutPreferences | null {
  const db = getDb();

  if (!db) {
    const store = readJsonDb();
    if (!store[hangoutId]) {
      const defaultHangout = getDefaultHangout(hangoutId);
      store[hangoutId] = defaultHangout;
      writeJsonDb(store);
      return defaultHangout;
    }
    return store[hangoutId];
  }

  const getHangout = db.prepare(`SELECT * FROM hangouts WHERE id = ?`);
  let row = getHangout.get(hangoutId) as HangoutRow | undefined;

  if (!row) {
    saveHangoutToDb(getDefaultHangout(hangoutId));
    row = getHangout.get(hangoutId) as HangoutRow | undefined;
  }

  if (!row) return null;

  const getFriends = db.prepare(`SELECT * FROM friend_availabilities WHERE hangout_id = ? ORDER BY created_at ASC`);
  const friendRows = getFriends.all(hangoutId) as unknown as FriendRow[];

  const friends: Friend[] = friendRows.map((fr) => ({
    id: fr.friend_id,
    name: fr.friend_name,
    avatarColor: fr.avatar_color,
    availabilitySlots: [
      {
        id: `slot-${fr.friend_id}`,
        startTime: fr.start_time,
        endTime: fr.end_time,
      },
    ],
    budgetPreference: fr.budget_preference || undefined,
    topInterests: fr.top_interests ? JSON.parse(fr.top_interests) : [],
    status: fr.status,
    submittedAt: fr.submitted_at || undefined,
  }));

  return {
    id: row.id,
    groupName: row.group_name,
    location: row.location,
    date: row.date,
    timePreference: row.time_preference,
    maxBudgetPerPerson: row.max_budget,
    selectedInterests: JSON.parse(row.selected_interests) as ActivityCategory[],
    friendCount: friends.length,
    friends,
  };
}

export function updateFriendSubmission(
  hangoutId: string,
  friendId: string,
  data: {
    friendName?: string;
    avatarColor?: string;
    startTime: string;
    endTime: string;
    budgetPreference?: number;
    topInterests?: ActivityCategory[];
  }
): boolean {
  const db = getDb();

  if (!db) {
    const store = readJsonDb();
    let hangout = store[hangoutId];
    if (!hangout) {
      hangout = getDefaultHangout(hangoutId);
      store[hangoutId] = hangout;
    }

    const existingFriend = hangout.friends.find((f) => f.id === friendId);
    if (existingFriend) {
      if (data.friendName) existingFriend.name = data.friendName;
      if (data.avatarColor) existingFriend.avatarColor = data.avatarColor;
      existingFriend.availabilitySlots = [
        {
          id: `slot-${friendId}`,
          startTime: data.startTime,
          endTime: data.endTime,
        },
      ];
      if (data.budgetPreference !== undefined) existingFriend.budgetPreference = data.budgetPreference;
      if (data.topInterests) existingFriend.topInterests = data.topInterests;
      existingFriend.status = 'submitted';
      existingFriend.submittedAt = new Date().toISOString();
    } else {
      hangout.friends.push({
        id: friendId,
        name: data.friendName || `Mate ${friendId}`,
        avatarColor: data.avatarColor || 'bg-teal-600 text-white',
        availabilitySlots: [
          {
            id: `slot-${friendId}`,
            startTime: data.startTime,
            endTime: data.endTime,
          },
        ],
        budgetPreference: data.budgetPreference,
        topInterests: data.topInterests || [],
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      });
      hangout.friendCount = hangout.friends.length;
    }

    writeJsonDb(store);
    return true;
  }

  const checkHangout = db.prepare('SELECT id FROM hangouts WHERE id = ?');
  let hangout = checkHangout.get(hangoutId);
  if (!hangout) {
    saveHangoutToDb(getDefaultHangout(hangoutId));
    hangout = checkHangout.get(hangoutId);
  }

  const now = new Date().toISOString();
  const rowId = `${hangoutId}_${friendId}`;

  const updateStmt = db.prepare(`
    INSERT INTO friend_availabilities (
      id, hangout_id, friend_id, friend_name, avatar_color,
      start_time, end_time, budget_preference, top_interests, status, submitted_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
    ON CONFLICT(hangout_id, friend_id) DO UPDATE SET
      friend_name = coalesce(?, friend_availabilities.friend_name),
      avatar_color = coalesce(?, friend_availabilities.avatar_color),
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      budget_preference = coalesce(excluded.budget_preference, friend_availabilities.budget_preference),
      top_interests = coalesce(excluded.top_interests, friend_availabilities.top_interests),
      status = 'submitted',
      submitted_at = excluded.submitted_at
  `);

  updateStmt.run(
    rowId,
    hangoutId,
    friendId,
    data.friendName || `Mate ${friendId}`,
    data.avatarColor || 'bg-teal-600 text-white',
    data.startTime,
    data.endTime,
    data.budgetPreference || null,
    data.topInterests ? JSON.stringify(data.topInterests) : null,
    now,
    data.friendName || null,
    data.avatarColor || null
  );

  // Mark hangout updated
  const touchHangout = db.prepare('UPDATE hangouts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  touchHangout.run(hangoutId);

  return true;
}
