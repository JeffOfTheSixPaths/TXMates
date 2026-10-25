import { DatabaseSync } from 'node:sqlite';
import type { Activity, ItemVoteReaction, UserItemVote } from '@/types';

export function ensureUserItemVotesTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_item_votes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      customer_id TEXT,
      friend_name TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      activity_name TEXT NOT NULL,
      vote TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, activity_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_item_votes_user ON user_item_votes(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_item_votes_activity ON user_item_votes(activity_id);
    CREATE INDEX IF NOT EXISTS idx_user_item_votes_customer ON user_item_votes(customer_id);
  `);
}

export interface RecordItemVoteInput {
  userId: string;
  customerId?: string;
  friendName: string;
  activityId: string;
  activityName: string;
  vote: ItemVoteReaction | null;
}

export function recordUserItemVote(
  db: DatabaseSync,
  input: RecordItemVoteInput
): { ok: boolean; vote: ItemVoteReaction | null; removed?: boolean } {
  ensureUserItemVotesTable(db);

  if (!input.vote) {
    const deleteStmt = db.prepare(`
      DELETE FROM user_item_votes
      WHERE user_id = ? AND activity_id = ?
    `);
    deleteStmt.run(input.userId, input.activityId);
    return { ok: true, vote: null, removed: true };
  }

  const id = `${input.userId}_${input.activityId}`;
  const upsertStmt = db.prepare(`
    INSERT INTO user_item_votes (
      id, user_id, customer_id, friend_name, activity_id, activity_name, vote, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, activity_id) DO UPDATE SET
      customer_id = coalesce(excluded.customer_id, user_item_votes.customer_id),
      friend_name = excluded.friend_name,
      activity_name = excluded.activity_name,
      vote = excluded.vote,
      updated_at = CURRENT_TIMESTAMP
  `);

  upsertStmt.run(
    id,
    input.userId,
    input.customerId || null,
    input.friendName,
    input.activityId,
    input.activityName,
    input.vote
  );

  return { ok: true, vote: input.vote, removed: false };
}

interface RawVoteRow {
  id: string;
  user_id: string;
  customer_id: string | null;
  friend_name: string;
  activity_id: string;
  activity_name: string;
  vote: string;
  created_at: string;
  updated_at: string;
}

export function getUserItemVotes(
  db: DatabaseSync,
  filters?: { userIds?: string[]; customerIds?: string[]; activityIds?: string[] }
): UserItemVote[] {
  ensureUserItemVotesTable(db);

  const clauses: string[] = [];
  const params: string[] = [];

  if (filters?.userIds && filters.userIds.length > 0) {
    const placeholders = filters.userIds.map(() => '?').join(',');
    clauses.push(`user_id IN (${placeholders})`);
    params.push(...filters.userIds);
  }

  if (filters?.customerIds && filters.customerIds.length > 0) {
    const placeholders = filters.customerIds.map(() => '?').join(',');
    clauses.push(`customer_id IN (${placeholders})`);
    params.push(...filters.customerIds);
  }

  if (filters?.activityIds && filters.activityIds.length > 0) {
    const placeholders = filters.activityIds.map(() => '?').join(',');
    clauses.push(`activity_id IN (${placeholders})`);
    params.push(...filters.activityIds);
  }

  let sql = 'SELECT * FROM user_item_votes';
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(' OR ')}`;
  }
  sql += ' ORDER BY updated_at DESC';

  const rows = db.prepare(sql).all(...params) as unknown as RawVoteRow[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    customerId: r.customer_id || undefined,
    friendName: r.friend_name,
    activityId: r.activity_id,
    activityName: r.activity_name,
    vote: r.vote as ItemVoteReaction,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function normalizePlaceName(name: string): string {
  return name.toLowerCase().replace(/['"’]/g, '').trim();
}

export function getDownvotedActivities(
  db: DatabaseSync,
  filters?: { userIds?: string[]; customerIds?: string[] }
): {
  ids: Set<string>;
  names: Set<string>;
  details: Array<{ userId: string; customerId?: string; friendName: string; activityId: string; activityName: string }>;
} {
  ensureUserItemVotesTable(db);

  const clauses: string[] = ["vote = 'down'"];
  const params: string[] = [];

  const idClauses: string[] = [];
  if (filters?.userIds && filters.userIds.length > 0) {
    const placeholders = filters.userIds.map(() => '?').join(',');
    idClauses.push(`user_id IN (${placeholders})`);
    params.push(...filters.userIds);
  }
  if (filters?.customerIds && filters.customerIds.length > 0) {
    const placeholders = filters.customerIds.map(() => '?').join(',');
    idClauses.push(`customer_id IN (${placeholders})`);
    params.push(...filters.customerIds);
  }

  if (idClauses.length > 0) {
    clauses.push(`(${idClauses.join(' OR ')})`);
  }

  const sql = `SELECT * FROM user_item_votes WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(...params) as unknown as RawVoteRow[];

  const ids = new Set<string>();
  const names = new Set<string>();
  const details = rows.map((r) => {
    ids.add(r.activity_id);
    if (r.activity_name) {
      names.add(r.activity_name.toLowerCase().trim());
      names.add(normalizePlaceName(r.activity_name));
    }
    return {
      userId: r.user_id,
      customerId: r.customer_id || undefined,
      friendName: r.friend_name,
      activityId: r.activity_id,
      activityName: r.activity_name,
    };
  });

  return { ids, names, details };
}

export function isActivityDownvoted(
  activity: { id: string; name: string; venue?: string; neighborhood?: string },
  downvotedIds?: Set<string>,
  downvotedNames?: Set<string>
): boolean {
  if (downvotedIds && downvotedIds.has(activity.id)) return true;
  if (!downvotedNames || downvotedNames.size === 0) return false;

  const namesToCheck = [
    activity.name?.toLowerCase().trim(),
    activity.name ? normalizePlaceName(activity.name) : undefined,
    activity.venue?.toLowerCase().trim(),
    activity.venue ? normalizePlaceName(activity.venue) : undefined,
    activity.neighborhood?.toLowerCase().trim(),
    activity.neighborhood ? normalizePlaceName(activity.neighborhood) : undefined,
  ].filter((n): n is string => Boolean(n));

  for (const n of namesToCheck) {
    if (downvotedNames.has(n)) return true;
  }

  // Also match if any downvoted name is contained within or contains candidate's name/venue
  for (const dName of downvotedNames) {
    if (dName.length >= 4) {
      for (const n of namesToCheck) {
        if (n.includes(dName) || dName.includes(n)) return true;
      }
    }
  }

  return false;
}

export function penalizeDownvotedActivities(
  activities: Activity[],
  downvotedIds?: Set<string>,
  downvotedNames?: Set<string>
): {
  preferred: Activity[];
  deprioritized: Activity[];
  allRanked: Activity[];
} {
  const preferred: Activity[] = [];
  const deprioritized: Activity[] = [];

  for (const act of activities) {
    if (isActivityDownvoted(act, downvotedIds, downvotedNames)) {
      deprioritized.push(act);
    } else {
      preferred.push(act);
    }
  }

  return {
    preferred,
    deprioritized,
    allRanked: [...preferred, ...deprioritized],
  };
}
