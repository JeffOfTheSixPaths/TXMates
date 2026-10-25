/**
 * Delete committed events whose end date (or start date, when there is no end)
 * is before today in America/Chicago. Undated events are kept. Safe to run twice.
 */
import { pruneEventDirectory, eventsDirectory } from '../lib/eventCatalog';

const result = pruneEventDirectory(eventsDirectory(), new Date());
if (result.removed.length === 0) {
  console.log(
    `No past events to remove. Today in America/Chicago is ${result.today}. Kept ${result.kept} events (${result.undated} undated).`
  );
} else {
  console.log(`Removed ${result.removed.length} past events. Today in America/Chicago is ${result.today}.`);
  for (const event of result.removed) {
    const span = event.endDate && event.endDate !== event.startDate ? `${event.startDate}–${event.endDate}` : event.endDate || event.startDate;
    console.log(`- ${event.bucket}/${event.id}  ${event.name}  ${span}`);
  }
  console.log(`Kept ${result.kept} events (${result.undated} undated).`);
}
for (const file of result.unreadable) {
  console.log(`Left unreadable event file in place: ${file}`);
}
