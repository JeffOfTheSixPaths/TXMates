This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

TXMates plans a friend hangout: shared hours, an Austin shortlist, and a per-person budget. Copy `.env.example` to `.env.local` before using live Nessie or OpenSERP.

## Nessie budget

The hangout form asks `/api/nessie/budget` for a suggested per-person cap. That route is the only place the Capital One Nessie key is used. It reads the customer's accounts, purchases, and bills from `http://api.nessieisreal.com` (override with `NESSIE_BASE_URL`).

The suggestion keeps a 10% safety buffer (at least $50), subtracts typical monthly spending, upcoming one-time bills, and recurring charges. Monthly bills and purchases that repeat about every 20–45 days count in full. Annual bills and purchases that repeat about every 300–400 days, or anything labeled annual, are divided by 12. The form prefills the result and still lets you type a different cap. Changing the number stops later Nessie reads from overwriting it. Use the button to apply a new suggestion.

`NESSIE_CUSTOMER_ID` pins the customer. Without it, the form lists the customers on the key when there is more than one. `NESSIE_ACCOUNT_ID` pins one or more account ids (comma-separated). Without it, every account is included, and the form can narrow to one. Credit card balances are treated as money already owed. If the key is missing or Nessie fails, the cap stays at $50 and the page calls it an estimate.

## OpenSERP on Windows

Discovery calls a local OpenSERP server at `OPENSERP_URL` (default `http://127.0.0.1:7000`). The request waits `OPENSERP_TIMEOUT_MS` milliseconds, default 8000, then falls back to the curated Austin catalog. The page says whether the list is live or the demo catalog, and it stays on a loading message until the first answer arrives.

From a prebuilt Windows release, in the folder that contains the binary:

```bat
openserp.exe serve -a 127.0.0.1 -p 7000
```

Then open Discover in the app.

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
