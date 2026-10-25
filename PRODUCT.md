# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Confirmed from the app: one person organizes a friend group (the lead organizer) and the other friends answer a personal availability link.

Inferred, labeled because this record was written from the repository without a live interview: the organizer is usually on a laptop, setting the group, date, budget, and interests, then sending links. Friends open `/avail/[id]` on a phone, mark the hours they are free, and optionally share a budget comfort and interests. The job is to leave with a time everyone can make, a per-person spend that fits, and a short Austin plan the group will actually attend.

## Product Purpose

TXMates helps a friend group plan a hangout. It combines shared free time, a per-person budget, and a catalog of local activities into a short itinerary. Success is a plan the group can vote on and lock, with each friend’s window reflected in the overlap.

## Positioning

The mechanism is the overlap: the latest start and earliest end across friends, a shared dollar cap, and three plan strategies (best overall, cheapest, best interest match) drawn from the same constraints. A calendar poll does not price the day. A venue search does not know who is free. Confirmed in code: deterministic planning in `friend-hangout/lib/planner.ts`, with optional live copy from Meta Muse Spark when that API responds.

## Operating Context

The working app lives in `friend-hangout/`. Routes in the code:

- `/` is the organizer’s planner. It auto-saves preferences, polls for friend submissions, and shows the generated plan.
- `/avail/[id]` is the friend-facing availability page (When2Meet-style in the product’s own words), including a per-hour overlap heatmap.

The demo squad in code is “The goobers” in Austin, TX, on 2026-10-26, four friends, $50 per person, interests in food, music, outdoors, and gaming. Venue discovery calls `/api/discovery` and falls back to a curated Austin catalog when OpenSerp is not running. Hangouts persist in a local SQLite file at `friend-hangout/data/txmates.db`.

## Capabilities and Constraints

Confirmed:

- Group name, city or neighborhood, date, and time-of-day preference (afternoon, evening, night, all day).
- Friends can be added, renamed, and removed (at least one remains). Each friend has one free-time window.
- Personal and general availability links copy to the clipboard. Submissions update friend status to submitted and the organizer view polls for changes.
- Max budget per person can be suggested from a server-side Capital One Nessie read of one customer's balances, purchases, and bills. The person can override it. If the key is missing or Nessie fails, the cap stays an estimate and the plan says so.
- Eight interest categories filter both the form and discovery: food, music, outdoors, gaming, sports, nightlife, arts, chill.
- Three planning views: overall, cheapest, interests. Each view can request Meta Muse Spark rationale, an icebreaker, and a coordination tip. If the model is unavailable, the deterministic rationale stays.
- Discovery supports search, category, max cost, and sort. A shortlist can be applied back onto selected interests. Prices in the catalog are estimates.
- Friends can cast a local thumbs-up or heart vote and lock or unlock the plan. Those votes live in component state only; they are not written to the database.
- An `openserp` directory exists at the repository root and is out of scope for this product’s UI.

Inferred and open:

- Meta Muse Spark and OpenSerp are live only when their services answer. Nessie is live only when `NESSIE_API_KEY` is set and the API returns accounts. Copy must keep calling a failed read an estimate.
- No production domain, analytics, or authentication is present. Do not invent accounts, payments, or confirmed reservations.

## Brand Commitments

The product name is TXMates. The demo speaks in a casual friend-group voice (“mates”, squad names like “The goobers”, Austin neighborhoods). That voice is in the shipping copy and should stay recognizable. No logo file, color system, or typography was committed by the repository beyond the current implementation, and that implementation is not a brand constraint.

## Evidence on Hand

- Working UI: `friend-hangout/app/page.tsx`, `friend-hangout/app/avail/[id]/page.tsx`, and `friend-hangout/components/`.
- Demo friends and Austin venues: `friend-hangout/lib/mockData.ts`.
- Saved demo hangout shape: `friend-hangout/data/txmates.json`.
- No testimonials, press, photography, or customer logos. Do not fabricate them. Venue names in the catalog are real Austin places used as demo content; hours, prices, and ratings in that file are estimates, which the discovery UI already warns about.

## Product Principles

- Show the overlap. The hours everyone shares and the dollars each person can spend are the plan, not a footnote.
- Say when a number is estimated or simulated. Discovery prices, Nessie, and Muse fallbacks must stay honest.
- The organizer and the invited friend are different jobs. The dashboard can be dense; the availability link must be completable on a phone.
- Keep the group’s language. Names, neighborhoods, and the plan itself carry the personality.
- Do not block the task with marketing. The first screen is a hangout being planned.

## Accessibility & Inclusion

No formal standard was declared in the repo. Inferred requirement: body text and form labels stay readable on a phone in daylight, controls are reachable by keyboard, and status (submitted, over budget, live versus simulated) is not communicated by color alone.
