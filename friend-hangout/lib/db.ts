import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import type { HangoutPreferences, Friend, ActivityCategory } from '@/types';
import { ensureActivityTables, purgeJunkActivities } from './activityStore';
import { ensureItineraryLockColumns } from './itineraryLock';
import { ensureMuseCache } from './museCache';
import { ensureMuseUsage } from './museUsage';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'txmates.db');

let dbInstance: DatabaseSync | null = null;

export function initHangoutDb(db: DatabaseSync) {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
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
  ensureActivityTables(db);
  purgeJunkActivities(db);
  ensureMuseCache(db);
  ensureMuseUsage(db);
  ensureItineraryLockColumns(db);
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initHangoutDb(dbInstance);
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

export function saveHangoutToDb(hangout: HangoutPreferences, db: DatabaseSync = getDb()): string {
  const id = hangout.id || 'txmates-demo';

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

  const getHangout = db.prepare(`SELECT * FROM hangouts WHERE id = ?`);
  let row = getHangout.get(hangoutId) as HangoutRow | undefined;

  if (!row) {
    saveHangoutToDb({
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
    });
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
    startTime: string;
    endTime: string;
    budgetPreference?: number;
    topInterests?: ActivityCategory[];
  }
): boolean {
  const db = getDb();

  const checkHangout = db.prepare('SELECT id FROM hangouts WHERE id = ?');
  let hangout = checkHangout.get(hangoutId);
  if (!hangout) {
    saveHangoutToDb({
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
    });
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
    'bg-teal-600 text-white',
    data.startTime,
    data.endTime,
    data.budgetPreference || null,
    data.topInterests ? JSON.stringify(data.topInterests) : null,
    now,
    data.friendName || null
  );

  return true;
}
