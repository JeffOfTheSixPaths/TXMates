/**
 * Add upcoming Austin events from Ticketmaster when TICKETMASTER_API_KEY is set.
 * Without the key this is a no-op. Re-running does not duplicate a name on the same start date.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectIntoEventDirectory } from '../lib/eventCollect';
import { parseEnvFile } from '../lib/nessieSeed';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadLocalEnv() {
  let text = '';
  try {
    text = readFileSync(path.join(root, '.env.local'), 'utf8');
  } catch {
    return;
  }
  const values = parseEnvFile(text);
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();
  const summary = await collectIntoEventDirectory({ apiKey: process.env.TICKETMASTER_API_KEY });
  console.log(summary);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Event collection failed';
  console.error(message);
  process.exitCode = 1;
});
