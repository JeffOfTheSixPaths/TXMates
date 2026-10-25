import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import type { HangoutPreferences, Friend, ActivityCategory, FriendCalendarSyncDetails, TimeSlot } from '@/types';
import { ensureActivityTables, purgeJunkActivities } from './activityStore';
import { ensureItineraryLockColumns } from './itineraryLock';
import { ensureMuseCache } from './museCache';
import { ensureMuseUsage } from './museUsage';
import { ensureUserItemVotesTable } from './userVotes';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'txmates.db');

let dbInstance: DatabaseSync | null = null;

export function ensureFriendCalendarColumns(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare(`PRAGMA table_info(friend_availabilities)`).all() as Array<{ name: string }>).map(
      (column) => column.name
    )
  );
  if (!columns.has('calendar_synced')) {
    db.exec(`ALTER TABLE friend_availabilities ADD COLUMN calendar_synced INTEGER DEFAULT 0`);
  }
  if (!columns.has('calendar_sync_details')) {
    db.exec(`ALTER TABLE friend_availabilities ADD COLUMN calendar_sync_details TEXT`);
  }
}

export function ensureHangoutDateColumns(db: DatabaseSync) {
  const hangoutCols = new Set(
    (db.prepare(`PRAGMA table_info(hangouts)`).all() as Array<{ name: string }>).map(
      (column) => column.name
    )
  );
  if (!hangoutCols.has('selected_dates')) {
    db.exec(`ALTER TABLE hangouts ADD COLUMN selected_dates TEXT`);
  }

  const friendCols = new Set(
    (db.prepare(`PRAGMA table_info(friend_availabilities)`).all() as Array<{ name: string }>).map(
      (column) => column.name
    )
  );
  if (!friendCols.has('slots_json')) {
    db.exec(`ALTER TABLE friend_availabilities ADD COLUMN slots_json TEXT`);
  }
}

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
        calendar_synced INTEGER DEFAULT 0,
        calendar_sync_details TEXT,
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
  ensureFriendCalendarColumns(db);
  ensureHangoutDateColumns(db);
  ensureUserItemVotesTable(db);
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
  selected_dates?: string | null;
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
  slots_json?: string | null;
  budget_preference: number | null;
  top_interests: string | null;
  status: 'pending' | 'submitted';
  submitted_at: string | null;
  calendar_synced: number | null;
  calendar_sync_details: string | null;
}

export function saveHangoutToDb(hangout: HangoutPreferences, db: DatabaseSync = getDb()): string {
  ensureFriendCalendarColumns(db);
  ensureHangoutDateColumns(db);
  const id = hangout.id || 'txmates-demo';
  const selectedDates =
    hangout.selectedDates && hangout.selectedDates.length > 0
      ? hangout.selectedDates
      : [hangout.date];

  const upsertHangout = db.prepare(`
    INSERT INTO hangouts (id, group_name, location, date, selected_dates, time_preference, max_budget, selected_interests, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      group_name = excluded.group_name,
      location = excluded.location,
      date = excluded.date,
      selected_dates = excluded.selected_dates,
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
    JSON.stringify(selectedDates),
    hangout.timePreference,
    hangout.maxBudgetPerPerson,
    JSON.stringify(hangout.selectedInterests)
  );

  const upsertFriend = db.prepare(`
    INSERT INTO friend_availabilities (
      id, hangout_id, friend_id, friend_name, avatar_color,
      start_time, end_time, slots_json, budget_preference, top_interests, status, submitted_at,
      calendar_synced, calendar_sync_details
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hangout_id, friend_id) DO UPDATE SET
      friend_name = excluded.friend_name,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      slots_json = coalesce(excluded.slots_json, friend_availabilities.slots_json),
      budget_preference = coalesce(excluded.budget_preference, friend_availabilities.budget_preference),
      top_interests = coalesce(excluded.top_interests, friend_availabilities.top_interests),
      status = CASE WHEN friend_availabilities.status = 'submitted' THEN 'submitted' ELSE excluded.status END,
      calendar_synced = coalesce(excluded.calendar_synced, friend_availabilities.calendar_synced),
      calendar_sync_details = coalesce(excluded.calendar_sync_details, friend_availabilities.calendar_sync_details)
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
      f.availabilitySlots && f.availabilitySlots.length > 0 ? JSON.stringify(f.availabilitySlots) : null,
      f.budgetPreference || null,
      f.topInterests ? JSON.stringify(f.topInterests) : null,
      f.status || 'pending',
      f.submittedAt || null,
      f.calendarSynced ? 1 : 0,
      f.calendarSyncDetails ? JSON.stringify(f.calendarSyncDetails) : null
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
      groupName: 'Group Name Here',
      location: 'Austin, TX',
      date: '2026-10-26',
      timePreference: 'afternoon',
      maxBudgetPerPerson: 50,
      selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
      friendCount: 4,
      friends: [
        {
          id: 'f-1',
          name: 'Marcus W. (Organizer)',
          avatarColor: 'bg-teal-600 text-white',
          availabilitySlots: [{ id: 's-1', startTime: '13:00', endTime: '21:00' }],
          budgetPreference: 35,
          topInterests: ['food', 'music', 'gaming'],
        },
        {
          id: 'f-2',
          name: 'Priya R.',
          avatarColor: 'bg-purple-600 text-white',
          availabilitySlots: [{ id: 's-2', startTime: '14:30', endTime: '20:30' }],
          budgetPreference: 50,
          topInterests: ['arts', 'chill', 'food'],
        },
        {
          id: 'f-3',
          name: 'Tyler N.',
          avatarColor: 'bg-amber-600 text-white',
          availabilitySlots: [{ id: 's-3', startTime: '15:00', endTime: '22:00' }],
          budgetPreference: 15,
          topInterests: ['gaming', 'sports', 'nightlife'],
        },
        {
          id: 'f-4',
          name: 'Elena M.',
          avatarColor: 'bg-emerald-600 text-white',
          availabilitySlots: [{ id: 's-4', startTime: '14:00', endTime: '21:30' }],
          budgetPreference: 20,
          topInterests: ['outdoors', 'chill', 'music'],
        },
      ],
    });
    row = getHangout.get(hangoutId) as HangoutRow | undefined;
  }

  if (!row) return null;

  ensureFriendCalendarColumns(db);
  ensureHangoutDateColumns(db);
  const getFriends = db.prepare(`SELECT * FROM friend_availabilities WHERE hangout_id = ? ORDER BY created_at ASC`);
  const friendRows = getFriends.all(hangoutId) as unknown as FriendRow[];

  const selectedDates: string[] = row.selected_dates
    ? JSON.parse(row.selected_dates)
    : [row.date];

  const friends: Friend[] = friendRows.map((fr) => {
    let availabilitySlots: TimeSlot[] = [];
    if (fr.slots_json) {
      try {
        availabilitySlots = JSON.parse(fr.slots_json);
      } catch {
        availabilitySlots = [];
      }
    }
    if (!availabilitySlots || availabilitySlots.length === 0) {
      availabilitySlots = [
        {
          id: `slot-${fr.friend_id}`,
          startTime: fr.start_time,
          endTime: fr.end_time,
        },
      ];
    }
    return {
      id: fr.friend_id,
      name: fr.friend_name,
      avatarColor: fr.avatar_color,
      availabilitySlots,
      budgetPreference: fr.budget_preference || undefined,
      topInterests: fr.top_interests ? JSON.parse(fr.top_interests) : [],
      status: fr.status,
      submittedAt: fr.submitted_at || undefined,
      calendarSynced: fr.calendar_synced === 1,
      calendarSyncDetails: fr.calendar_sync_details ? JSON.parse(fr.calendar_sync_details) : undefined,
    };
  });

  return {
    id: row.id,
    groupName: row.group_name,
    location: row.location,
    date: row.date,
    selectedDates,
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
    slots?: TimeSlot[];
    date?: string;
    budgetPreference?: number;
    topInterests?: ActivityCategory[];
    calendarSynced?: boolean;
    calendarSyncDetails?: FriendCalendarSyncDetails;
  }
): boolean {
  const db = getDb();
  ensureFriendCalendarColumns(db);
  ensureHangoutDateColumns(db);

  let slotsJson: string | null = null;
  if (data.slots && data.slots.length > 0) {
    slotsJson = JSON.stringify(data.slots);
  } else if (data.date) {
    const existing = db
      .prepare('SELECT slots_json, start_time, end_time FROM friend_availabilities WHERE hangout_id = ? AND friend_id = ?')
      .get(hangoutId, friendId) as { slots_json?: string; start_time?: string; end_time?: string } | undefined;
    let slots: TimeSlot[] = [];
    if (existing?.slots_json) {
      try {
        slots = JSON.parse(existing.slots_json);
      } catch {
        slots = [];
      }
    }
    const idx = slots.findIndex((s) => s.date === data.date);
    if (idx >= 0) {
      slots[idx] = { ...slots[idx], startTime: data.startTime, endTime: data.endTime };
    } else {
      slots.push({
        id: `slot-${friendId}-${data.date}`,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
      });
    }
    slotsJson = JSON.stringify(slots);
  }

  const checkHangout = db.prepare('SELECT id FROM hangouts WHERE id = ?');
  let hangout = checkHangout.get(hangoutId);
  if (!hangout) {
    saveHangoutToDb({
      id: hangoutId,
      groupName: 'Group Name Here',
      location: 'Austin, TX',
      date: '2026-10-26',
      timePreference: 'afternoon',
      maxBudgetPerPerson: 50,
      selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
      friendCount: 4,
      friends: [
        {
          id: 'f-1',
          name: 'Marcus W. (Organizer)',
          avatarColor: 'bg-teal-600 text-white',
          availabilitySlots: [{ id: 's-1', startTime: '13:00', endTime: '21:00' }],
          budgetPreference: 35,
          topInterests: ['food', 'music', 'gaming'],
        },
        {
          id: 'f-2',
          name: 'Priya R.',
          avatarColor: 'bg-purple-600 text-white',
          availabilitySlots: [{ id: 's-2', startTime: '14:30', endTime: '20:30' }],
          budgetPreference: 50,
          topInterests: ['arts', 'chill', 'food'],
        },
        {
          id: 'f-3',
          name: 'Tyler N.',
          avatarColor: 'bg-amber-600 text-white',
          availabilitySlots: [{ id: 's-3', startTime: '15:00', endTime: '22:00' }],
          budgetPreference: 15,
          topInterests: ['gaming', 'sports', 'nightlife'],
        },
        {
          id: 'f-4',
          name: 'Elena M.',
          avatarColor: 'bg-emerald-600 text-white',
          availabilitySlots: [{ id: 's-4', startTime: '14:00', endTime: '21:30' }],
          budgetPreference: 20,
          topInterests: ['outdoors', 'chill', 'music'],
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
      start_time, end_time, slots_json, budget_preference, top_interests, status, submitted_at,
      calendar_synced, calendar_sync_details
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?)
    ON CONFLICT(hangout_id, friend_id) DO UPDATE SET
      friend_name = coalesce(?, friend_availabilities.friend_name),
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      slots_json = coalesce(excluded.slots_json, friend_availabilities.slots_json),
      budget_preference = coalesce(excluded.budget_preference, friend_availabilities.budget_preference),
      top_interests = coalesce(excluded.top_interests, friend_availabilities.top_interests),
      status = 'submitted',
      submitted_at = excluded.submitted_at,
      calendar_synced = coalesce(excluded.calendar_synced, friend_availabilities.calendar_synced),
      calendar_sync_details = coalesce(excluded.calendar_sync_details, friend_availabilities.calendar_sync_details)
  `);

  updateStmt.run(
    rowId,
    hangoutId,
    friendId,
    data.friendName || `Mate ${friendId}`,
    'bg-teal-600 text-white',
    data.startTime,
    data.endTime,
    slotsJson,
    data.budgetPreference || null,
    data.topInterests ? JSON.stringify(data.topInterests) : null,
    now,
    data.calendarSynced !== undefined ? (data.calendarSynced ? 1 : 0) : null,
    data.calendarSyncDetails ? JSON.stringify(data.calendarSyncDetails) : null,
    data.friendName || null
  );

  return true;
}
