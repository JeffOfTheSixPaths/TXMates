# TXMates

The Next.js app lives in [`friend-hangout`](friend-hangout). Setup, the Nessie budget, and local OpenSERP are documented in [friend-hangout/README.md](friend-hangout/README.md).

Upcoming Austin events are JSON files in `friend-hangout/data/events/` (`local` for things to do, `shows` for concerts and sports). From `friend-hangout`, `npm run events:prune` removes events that ended before today in America/Chicago, and a daily GitHub Actions workflow commits that cleanup. `npm run events:collect` can add Ticketmaster listings when `TICKETMASTER_API_KEY` is set. Details are in the friend-hangout README.

## Impeccable in Cursor

Impeccable is installed at `.cursor/skills/impeccable`. Enable Agent Skills in Cursor (Settings → Agents → Agent Skills), open this repo, and run `/impeccable`. Product context is in `PRODUCT.md`.
