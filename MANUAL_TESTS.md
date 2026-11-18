# Manual tests

There are 20 checks to run by hand on the real stack, before submitting and after any big change. The automated tests (`npm test`, `npm run test:e2e`) prove the rules. These checks prove the **screens** and the **fan experience**: what a person actually sees.

Write ✅ or ❌ in the last column. If a check fails, write what you saw.

## Setup

| Mode | PowerShell (Windows) | bash |
|---|---|---|
| **Normal** (5-minute holds) | `docker compose up --build -d --wait` | same |
| **Short holds + no lone seats** (checks 12 and 17) | `$env:HOLD_TTL_SECONDS=90; $env:NO_LONE_SEATS='true'; docker compose up --build -d --wait` | `HOLD_TTL_SECONDS=90 NO_LONE_SEATS=true docker compose up --build -d --wait` |
| **Back to normal** | `Remove-Item Env:HOLD_TTL_SECONDS, Env:NO_LONE_SEATS; docker compose up -d --wait` | `docker compose up -d --wait` |
| **Wipe all data** (fresh demo event) | `docker compose down -v` | same |

- **Two fans:** two browser tabs or windows. Each tab remembers its own fan, so tab 1 = **Dana** and tab 2 = **Noa**.
- **Addresses:**
  - Web app: http://localhost:5173
  - API docs: http://localhost:3000/docs. Click **Authorize** and paste a handle like `dana#4821` to act as that fan.

## The checks

| # | Area | Steps | Expected | ✅/❌ |
|---|---|---|---|---|
| 1 | **One command** | Clone into a new folder. `docker compose up --build`. | db, api and web become healthy. http://localhost:5173 shows "SeatRush Live: Opening Night", **On sale now**. No manual steps. | |
| 2 | **API docs** | Open `/docs` and `/docs-json`. | Every endpoint is listed with its body and errors, including `promoCode` on checkout. | |
| 3 | **Login & switching** | Tab 1: log in as "Dana". Tab 2: log in as "Dana" too. In tab 1, click **Switch user**. | The two Danas get different handles (`dana#1234`, `dana#5678`). The switch screen lists recent fans, and one click switches. | |
| 4 | **Admin screen** | Admin → set zones so row C is in no zone (e.g. A–B and D–E). Create. Then fix the zones and create again. | First: a readable message about the gap, nothing created. Second: "is created" with an **Open it** link. | |
| 5 | **Drop countdown** | Admin → **In 1 min** → Create. Open the Events list and the event page. | Both count down live. At 0:00 the hold buttons unlock **without a refresh**. | |
| 6 | **Before the drop (API)** | Create an event with a drop in 5 min. In `/docs`, POST a hold on it. | `403 SALE_NOT_OPEN` with a readable message. Viewing the event works with no login. | |
| 7 | **Hold** | Dana clicks 2 seats → **Hold 2 seats**. | A 5:00 countdown, the seats marked as hers. In Noa's tab, within ~2 s, those seats show as held. | |
| 8 | **Same seat, two fans** | Both tabs select the same free seat. Click **Hold** in both, as close together as you can. | One gets it. The other sees **"Someone just took …"** (never "Error 409"), and the map refreshes. | |
| 9 | **All or nothing + Idempotency** | (a) In `/docs` as Noa, hold B2. As Dana, hold `["B1","B2","B3"]`. (b) As Dana, send a hold twice with the same `Idempotency-Key` header. | (a) `409 SEAT_TAKEN` naming only B2. B1 and B3 stay free. (b) The second answer is `200` with the same `holdId` and header `Idempotent-Replayed: true`. | |
| 10 | **Per-fan limit** | Dana holds 3 seats and checks out. Then she tries to hold 2 more. | "You can have up to 4 seats for this show. You have 3, so you can add 1 more." Holding 1 works. | |
| 11 | **Release** | Dana holds seats → **Release**. | "Your seats are released." Noa's tab shows them free within ~2 s. | |
| 12 | **Expiry** *(short-holds mode)* | Dana holds seats and waits. | The banner is calm, turns **orange at 1:00** and **red at 0:30**. At 0:00 checkout is gone and **Try to hold them again** appears. Noa sees the seats free within 5 s and can hold them. | |
| 13 | **Checkout & My tickets** | Dana holds → **Checkout**. Open **My tickets**. | "You're going! 🎉". The seats are SOLD in Noa's tab. My tickets shows the event, seats, total and order number. | |
| 14 | **Double click** | Double-click **Hold**, then double-click **Checkout**. | Exactly one hold and one order. Check that My tickets has a single new order. | |
| 15 | **Best available** | On the demo event, ask for 2 together, then for 4 with a max price. | Central seats in the nearest row that fits. Options that can't fit right now are disabled, with the reason. | |
| 16 | **Brief example (rule 7)** | Admin: 3 rows × 8 seats, one zone A–C. Fan 1 holds A1–A4, fan 2 holds A5–A8, fan 3 holds B4–B5 and checks out. Fan 4: best available 2. | Fan 4 gets **B2–B3**. | |
| 17 | **No lone seats** *(NO_LONE_SEATS=true)* | Repeat check 16. Then, on a new event, hold B2+B3 in an empty row. | Best available gives **C4–C5**. B2+B3 is refused: "That would leave B1 on its own…". | |
| 18 | **Promo codes** | Admin: one zone priced **349.35**. Hold 1 seat, checkout with `SAVE10`. As a new fan, buy twice with `WELCOME20`. Try `FREE100`. | SAVE10: total **₪314.41** (saved ₪34.94). WELCOME20: ₪20 off the first time; the second time a clear message and the seats stay held. FREE100: "isn't a code we know". | |
| 19 | **Rush script** | `node scripts/rush.mjs 200` | `PASS`: 1 winner and 199 × `SEAT_TAKEN`. One fan with 10 holds gets 4 seats and 6 × `FAN_LIMIT_REACHED`. | |
| 20 | **Server down** | Hold seats. `docker compose stop api`. Click **Checkout**. Then `docker compose start api` and click **Try again**. | First: "We can't reach the server right now…" with **Try again**. After the restart: one order, not two. | |
