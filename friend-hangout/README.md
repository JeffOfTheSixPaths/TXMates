# TXMates app

This folder is the Next.js app. Setup, OpenSERP, SerpApi, Nessie, Muse, SQLite, and the Austin event calendar are in the [repository README](../README.md).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A friend marks hours at `/avail/txmates-demo`.

Upcoming Austin events ship in `data/events/local` (things to do) and `data/events/shows` (concerts and sports). `npm run events:prune` deletes a file whose end date, or start date when there is no end, is before today in America/Chicago. `npm run events:collect` adds Ticketmaster listings when `TICKETMASTER_API_KEY` is set, and leaves the folder alone when it is not.
