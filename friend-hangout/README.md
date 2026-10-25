This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

TXMates plans a friend hangout: shared hours, an Austin shortlist, and a per-person budget. Copy `.env.example` to `.env.local` before using live Nessie or OpenSERP.

## Nessie budget

The hangout form asks `/api/nessie/budget` for a suggested per-person cap. That route is the only place the Capital One Nessie key is used. It reads the customer's accounts, purchases, and bills from `https://api.nessieisreal.com`. Set `NESSIE_BASE_URL` to override that. The `https` host is the default because `http://api.nessieisreal.com` often refuses the connection on Windows.

The suggestion keeps a 10% safety buffer (at least $50), subtracts typical monthly spending, upcoming one-time bills, and recurring charges. Monthly bills and purchases that repeat about every 20–45 days count in full. Annual bills and purchases that repeat about every 300–400 days, or anything labeled annual, are divided by 12. The form prefills the result and still lets you type a different cap. Changing the number stops later Nessie reads from overwriting it. Use the button to apply a new suggestion.

`NESSIE_CUSTOMER_ID` pins the customer. Without it, the form lists the customers on the key when there is more than one. `NESSIE_ACCOUNT_ID` pins one or more account ids (comma-separated). Without it, every account is included, and the form can narrow to one. Credit card balances are treated as money already owed. If the key is missing or Nessie fails, the cap stays at $50 and the page calls it an estimate.

A key with no customers, accounts, or merchants shows a "No Nessie customers" note and keeps the $50 estimate. From the `friend-hangout` folder, `npm run nessie:seed` reads `NESSIE_API_KEY` from `.env.local` or the environment and creates a demo customer, a checking account, purchases, and recurring monthly and annual bills. It prints the new ids and never prints the key. Run it only when you want those records on that key.

## OpenSERP on Windows

Discovery calls a local OpenSERP server at `OPENSERP_URL` (default `http://127.0.0.1:7000`). The request waits `OPENSERP_TIMEOUT_MS` milliseconds, default 15000, and values above 30000 are capped. If `.env.local` still sets `8000` from an older copy of the example, raise it or delete the line so the new default applies. The default engines are `duckduckgo,bing` (`OPENSERP_ENGINES`). Google is left off because a cold three-engine search often exceeds the timeout. Cached engine results still return in well under a second.

Saved spots load from `data/txmates.db` immediately. OpenSERP runs in the background when that search is older than `ACTIVITY_CACHE_TTL_HOURS` (default 8, allowed 1–24). New rows are merged in. The page says whether a card is live or saved, when it was last seen, and whether it is an event (with dates when we could read them) or a place. A search that matches nothing shows the wider saved list, or the demo catalog if nothing is saved, with a notice instead of an empty page.

## Saved activities and Muse plans

OpenSERP rows are deduped by normalized URL plus name. A listing is an event when the title or snippet has a festival, concert, fair, ticket, tour, gig, lineup, carnival, or show, or a current date. Anything else is a place. If `MUSE_API_KEY` is set, a background Muse call can relabel new rows. Heuristics stay in place when Muse is missing or fails.

Events are deleted once the end date, or the start date when there is no end, is before today. An event with no parseable date is deleted `ACTIVITY_EVENT_TTL_DAYS` after it was last seen (default 30). Places stay until they have been missing from OpenSERP for `ACTIVITY_PLACE_STALE_DAYS` (default 60). `npm run refresh:activities` also rechecks places that have been quiet for `ACTIVITY_PLACE_RECHECK_DAYS` (default 30, up to `ACTIVITY_RECHECK_LIMIT` per run, default 8). A recheck that comes back with no matching name or URL removes that place. A failed recheck, such as OpenSERP being offline, leaves the row alone.

The refresh script also deletes expired rows and refreshes stale searches. It does not poll all day. Run it from the `friend-hangout` folder when you want a catch-up, or from Windows Task Scheduler. In Task Scheduler, set "Start in" to the `friend-hangout` folder and the action to:

```powershell
npm.cmd run refresh:activities
```

Add `--force` to refresh searches that are still inside the cache window. No Docker or Go is required.

Muse plan calls wait `MUSE_TIMEOUT_MS` milliseconds, default 25000, capped at 60000. The plan panel stays on the current copy and shows a loading note for that wait. A successful plan is stored under a hash of the normalized hangout inputs (group, date, budget, friends, activities, and view) for `MUSE_CACHE_TTL_HOURS` (default 12, cap 168). The same plan comes back from SQLite instead of calling Muse again, and the panel says it is a saved plan.

Muse also enriches each new OpenSERP row once (event or place, dates, venue, address, cost, category, and tags), ranks up to three stops with a "why this fits" line, and rewrites a real Nessie estimate in plain language. Heuristics stay in place when Muse is slow, missing, or over the daily cap. `MUSE_MAX_CALLS_PER_DAY` defaults to 200 and is capped at 1000. Cache hits do not count. Each outbound call is logged in SQLite with token counts when the API returns them. A saved card marked Muse was enriched. The hour grid uses leaf green: empty cells are the neutral surface (with a border), and the green deepens until everyone is free.

The overlap hours use the leaf green from the palette. Nobody free stays on the neutral surface with a visible border. In dark mode that surface is the dark neutral, not white. Partial hours are a lighter mix, and a full hour is solid leaf. The count on each cell and the legend say None, Some, or Everyone, so the shade is not the only signal.

From a prebuilt Windows release, in the folder that contains the binary:

```bat
openserp.exe serve -a 127.0.0.1 -p 7000
```

Then open Discover in the app. The first search for a new phrase can take about 15 seconds. Later visits to that phrase read the saved rows.

## Impeccable in Cursor

The design skill is installed for Cursor at the repository root in `.cursor/skills/impeccable`, with `PRODUCT.md` beside it. Cursor only loads project skills when Agent Skills are enabled (Cursor Settings → Agents → Agent Skills, or the equivalent toggle in your Cursor version). In chat, run `/impeccable` and then a command such as `craft`, `audit`, or `document`. Open the repo root so Cursor sees `.cursor`. The app folder resolves the same product file through `friend-hangout/PRODUCT.md`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
