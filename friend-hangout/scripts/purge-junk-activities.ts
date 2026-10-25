/**
 * Delete saved OpenSERP rows that are login pages, score sites, or a different city
 * than the search that stored them. Safe to run more than once. The app also does
 * this when it opens data/txmates.db.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { purgeJunkActivities } from '../lib/activityStore';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, 'data', 'txmates.db');

if (!existsSync(dbPath)) {
  console.log(`No saved activities at ${dbPath}.`);
} else {
  const db = new DatabaseSync(dbPath);
  const removed = purgeJunkActivities(db);
  db.close();
  console.log(`Removed ${removed} junk or wrong-city ${removed === 1 ? 'row' : 'rows'} from ${dbPath}.`);
}
