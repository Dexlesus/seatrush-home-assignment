# Manual tests

The automated tests (`npm test`, `npm run test:e2e`) prove the rules. These 20 checks prove what a **person** actually sees and does: two fans in two windows, the countdown colours, double clicks, a server that goes down, promo codes, and the API docs.

I ran them on the real Docker stack (`docker compose up --build`) on 18 November 2026. **All 20 pass.** Several of them found real problems, and each one was fixed, usually with a test written first (see [What the manual checks found](#what-the-manual-checks-found)).

**How each check was run** (the last column):
- **Browser:** I clicked through it by hand, in two browser windows (Dana and Noa) and in `/docs`.
- **Stack:** a script sent the same requests the screen sends, through the site's own `/api` proxy at `localhost:5173`, against the running containers. The numbers in the table come from that run. Where a screen detail matters, the automated web test that covers it is named.

## Setup

| Mode | bash (Git Bash) | PowerShell |
|---|---|---|
| **Normal** (5-minute holds) | `docker compose up --build -d --wait` | same |
| **Short holds** (check 12) | `HOLD_TTL_SECONDS=90 docker compose up --build -d --wait` | `$env:HOLD_TTL_SECONDS=90; docker compose up --build -d --wait` |
| **No lone seats** (check 17) | `NO_LONE_SEATS=true docker compose up -d --wait` | `$env:NO_LONE_SEATS='true'; docker compose up -d --wait` |
| **Back to normal** | `docker compose up -d --wait` | `Remove-Item Env:HOLD_TTL_SECONDS, Env:NO_LONE_SEATS; docker compose up -d --wait` |
| **Wipe all data** (fresh demo event) | `docker compose down -v` | same |

- **Two fans:** two browser windows. Each tab remembers its own fan: window 1 = **Dana**, window 2 = **Noa**.
- **Addresses:**
  - **Web app:** http://localhost:5173
  - **API docs:** http://localhost:3000/docs. Click **Authorize** and paste a handle like `dana#4821` to act as that fan.

## The checks

| # | Area | Steps | Expected | Result | How |
|---|---|---|---|---|---|
| 1 | **One command** | Clone into a new folder. `docker compose up --build`. | db, api and web become healthy. The site shows "SeatRush Live: Opening Night", **On sale now**. No manual steps. | ✅ | Browser |
| 2 | **API docs** | Open `/docs` and `/docs-json`. | Every endpoint is listed with its body and errors, including `promoCode` on checkout. | ✅ | Browser |
| 3 | **Login & switching** | Window 1: log in as "Dana". Window 2: log in as "Dana" too. In window 1, **Switch user**. | The two Danas get different handles (`dana#1234`, `dana#5678`). The switch screen lists recent fans, and one click switches. | ✅ | Browser |
| 4 | **Admin screen** | Admin → zones that leave row C in no zone (A–B and D–E). Create. Fix the zones, create again. | First: a readable message about the gap, nothing created. Second: "is created" with an **Open it** link. | ✅ | Browser |
| 5 | **Drop countdown** | Admin → **In 1 min** → Create. Open the Events list and the event page. | Both count down live. At 0:00 the hold buttons unlock **without a refresh**. | ✅ | Browser |
| 6 | **Before the drop (API)** | An event with a drop in 5 min. In `/docs`, POST a hold on it. | `403 SALE_NOT_OPEN` with a readable message. Viewing the event works with no login. | ✅ Got `403 SALE_NOT_OPEN` | Browser (`/docs`) |
| 7 | **Hold** | Dana clicks 2 seats → **Hold 2 seats**. | A 5:00 countdown, the seats marked as hers. In Noa's window, within ~2 s, those seats show as held. | ✅ | Browser |
| 8 | **Same seat, two fans** | Both windows select the same free seat and click **Hold** as close together as possible. | One gets it. The other sees **"Someone just took …"** (never "Error 409"), and the map refreshes. | ✅ | Browser |
| 9 | **All or nothing + Idempotency** | (a) In `/docs` as Noa, hold B2. As Dana, hold `["B1","B2","B3"]`. (b) As Dana, send a hold twice with the same `Idempotency-Key`. | (a) `409 SEAT_TAKEN` naming only B2; B1 and B3 stay free. (b) The second answer is `200`, same `holdId`, header `Idempotent-Replayed: true`. | ✅ | Browser (`/docs`) |
| 10 | **Per-fan limit** | A new fan holds 3 seats and checks out. Clicks 2 more seats. Then holds 1 and checks out. | After 3: "Click up to 1 seat… You already have 3". After 4: the map is closed for this fan. The API still refuses with `FAN_LIMIT_REACHED` if called directly. | ✅ | Browser |
| 11 | **Release** | Dana holds seats → **Release**. | "Your seats are released." Noa sees them free within ~2 s. | ✅ | Browser |
| 12 | **Expiry** *(90 s holds)* | Dana holds seats and waits. | Calm banner, **orange at 1:00**, **red at 0:30**. At 0:00 checkout is gone and **Try to hold them again** appears. Noa sees the seats free and can hold them. | ✅ | Browser |
| 13 | **Checkout & My tickets** | Dana holds B3+B4 → **Checkout**. Open **My tickets**. | The order is created, the seats are SOLD for Noa, and My tickets shows the event, seats, total and order number. | ✅ Checkout `201`, total ₪200; Noa sees `B3=SOLD B4=SOLD`; My tickets has 1 order with the event, seats and order id | Stack |
| 14 | **Double click** | Hold twice at once with one key, then checkout twice at once. | Exactly one hold and one order. | ✅ Holds `201` + `200` (same `holdId`, 1 active hold); checkouts `201` + `200`; **1 order**. The screen side (a double click sends one request) is the screen test in `EventPage.test.tsx` | Stack + web test |
| 15 | **Best available** | On the demo event: 2 together, then 4 with max ₪150. | Central seats in the nearest row that fits; the price filter skips the expensive rows. | ✅ 2 → **A8–A9** (centre of row A, 16 seats); 4 under ₪150 → **G7–G10** (Balcony). "N together" options that can't fit are disabled by `largestBlockAvailable` (`seats.test.ts`) | Stack + web test |
| 16 | **Brief example (rule 7)** | 3 rows × 8. Fan 1 holds A1–A4, fan 2 A5–A8, fan 3 buys B4–B5. Fan 4: best available 2. | Fan 4 gets **B2–B3**. | ✅ **B2–B3** | Stack |
| 17 | **No lone seats** *(`NO_LONE_SEATS=true`)* | Repeat check 16. On a new event, hold B2+B3 in an empty row. | Best available gives **C4–C5**. B2+B3 is refused, naming B1. | ✅ **C4–C5**; B2+B3 → `409 LONE_SEAT`: "This would leave B1 on its own…" | Stack |
| 18 | **Promo codes** | One zone at ₪349.35. Checkout with `SAVE10`. A new fan buys twice with `WELCOME20`. Try `FREE100`. | SAVE10: **₪314.41** (saved ₪34.94). WELCOME20: ₪20 off once; the second time a clear message and the hold stays. FREE100: unknown code. | ✅ SAVE10: subtotal 34935, discount 3494, **total 31441**. WELCOME20: −2000, then `409 PROMO_CODE_USED`, hold still active. FREE100: `400 PROMO_CODE_UNKNOWN` | Stack |
| 19 | **Rush script** | `node scripts/rush.mjs 200` | `PASS`: 1 winner and 199 × `SEAT_TAKEN`. One fan with 10 holds gets 4 seats. | ✅ `{ 201: 1, 409 SEAT_TAKEN: 199 }`, `{ 201: 4, 409 FAN_LIMIT_REACHED: 6 }`, **PASS** | Stack |
| 20 | **Server down** | Hold a seat. `docker compose stop api`. Checkout. `docker compose start api`, **Try again** with the same key. | First: "We can't reach the server right now…" with **Try again**. After the restart: one order, not two. | ✅ API down → the proxy answers `504` in **3 s**, which the screen shows as "can't reach the server" (`errors.test.ts`). After the restart: `201`, the retry `200`, **1 order** | Stack + web test |

## What the manual checks found
The checks exist to catch what the automated tests don't. These are the problems they found, and what changed.

| Found in | What I saw | What changed |
|---|---|---|
| Check 7 | To add a seat to a running hold, I had to release and hold again. | A conscious decision, now written in DECISIONS (*A hold can't grow*): growing a hold would let a fan keep seats forever by adding one every 5 minutes. |
| Check 9 | In `/docs`, after **Authorize** as Dana → **Logout** → **Authorize** as Noa, the previous request forms stayed open with Dana's body still typed in. Easy to send something as the wrong fan. | The docs page now starts clean on every Authorize and Logout. An E2E test checks the docs setup. |
| Check 10 | The seat tooltip covered the seat below it, so that seat couldn't be clicked. | The tooltip was replaced by an info strip above the map. |
| Check 10 | After buying 3 seats, the screen still let me select more seats than I was allowed. The API refused, but only after the click. | The event response now includes `maxSeatsPerFan`, and the screen caps the picks: "Click up to 1 seat… You already have 3". Unit-tested (`seatsLeftToPick`). |
| Check 12 | The countdown sometimes jumped between seconds. | The clock offset to the server is now smoothed: keep the best sample, and reset only on a real change. Unit-tested in `time.test.ts`. |
| Check 12 | The setup command used PowerShell syntax; in Git Bash it said `command not found`. | The setup table has both bash and PowerShell. |
| Check 20 | With the API stopped, nginx returned an HTML error page, and the screen said "Something went wrong" with no **Try again**. | An HTML 502/503/504 from the proxy now means "We can't reach the server", with **Try again** (test first). |
| Check 20 (final run) | With the API stopped, nginx waited about **38 s** before answering, so the screen waited for its own 15 s time-out. | `proxy_connect_timeout 3s` in `web/nginx.conf`: the answer comes in 3 s. A running API is not affected (it connects in milliseconds). |
| UI review | A scrollbar in the middle of the page; the hold actions at the bottom instead of next to the map; some text showed as broken characters; pointing at a held or sold seat didn't say which. | The details and actions moved to a side panel, and the seats shrink to fit. The broken characters (an editing script had saved the files in the wrong encoding) were fixed, and a test now fails if they come back (`sourceText.test.ts`). Hovering a seat says "Held by another fan" or "Sold" (screen test). |

**One small thing is still open:** if a fan asks the API for a seat they **already** hold, the message is "Someone just took J1". "You already hold J1" would be friendlier. The screen never sends this request (it shows the fan's own seats as theirs), so it only shows up in `/docs`.

## A personal note
I really enjoyed this assignment, and I want to thank you for the opportunity. I'd be happy to be examined on any part of it (the code, the decisions or the tests) if you find that relevant.
