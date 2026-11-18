# DECISIONS

## Architecture

```
web (React, :5173)  ──/api──▶  api (NestJS, :3000)  ──SQL──▶  PostgreSQL 17
  RTK Query, MUI            controllers → services → SQL       (all state lives here)
```

**API modules** (`api/src`):

| Module | What it owns |
|---|---|
| `events` | Create an event (zones and all its seats), the events list, the seat map (rule 1), and the demo-event seeder |
| `fans` | Login by name or handle (`dana#4821`), `FanGuard` (`X-Username`) |
| `holds` | Hold and release seats (rules 2–7). The **chain of checks** lives in `holds/checks`, and the **seat-selection strategies** in `holds/selection` |
| `orders` | Checkout (its own chain of checks) and "My tickets" (rule 8) |
| `idempotency` | `Idempotency-Key` for holds and checkout, in the same transaction as the work |
| `common`, `config`, `database` | One error shape and error catalog, fail-fast env validation, migrations, the database clock |

### How a hold request flows from the screen to the database
1. **Screen.** The fan clicks seats, or "N together". The button is disabled while the request is pending, and the request carries a fresh `Idempotency-Key` (reused only for a "Try again" after a network error).
2. **`POST /api/events/:id/holds`**:
   1. `FanGuard` reads `X-Username` and loads the fan (401 if unknown).
   2. The `ValidationPipe` checks the body (400).
3. **`HoldsService.hold`**:
   1. Picks a **Strategy**: `ExplicitSeatsStrategy` or `BestAvailableStrategy`.
   2. Fingerprints the request, then opens **one transaction**.
4. **`IdempotencyService`** runs `INSERT INTO idempotency_keys ... ON CONFLICT DO NOTHING`.
   - The key was seen before → it replays the stored answer (200) or refuses a different body (422).
5. **Locks, always in this order:**
   1. `SELECT ... FROM fans WHERE id = $1 FOR UPDATE`. One fan's parallel requests queue up (rule 4).
   2. The strategy picks the seat labels. Best available first locks every candidate seat, ordered by id.
   3. `SELECT ... FROM seats WHERE row_index IN (rows of the requested seats) ORDER BY id FOR UPDATE`. The **whole row** is locked: one request at a time per row (rule 6), and the no-lone-seats check sees neighbours nobody can change.
6. **Chain of Responsibility:**
   `SaleOpen (2) → SeatCount 1–4 (3) → SeatsExist → FanLimit (4) → SeatsAvailable, all or nothing (3/5/6) → NoLoneSeats (extra)`.
   The first failing link throws a `DomainError`, the transaction rolls back, and **nothing is held**.
7. **Writes:**
   1. `INSERT holds` with `expires_at = db now() + HOLD_TTL_SECONDS`.
   2. `INSERT hold_seats`.
   3. `UPDATE seats SET status = 'HELD', hold_id, held_until`.
   4. Store the response next to the idempotency key.
   5. COMMIT → **201**.
8. **Errors.** One exception filter turns every error into `{ statusCode, code, message, details, path, timestamp }`. The screen maps each `code` to a sentence ("Someone just took B3").

All SQL uses **parameters** (`$1, $2 ...`): user input is never pasted into SQL text. The only SQL that is built from pieces uses one of two fixed column names.

## Schema
| Table | Why |
|---|---|
| `events` | `drop_at`, `starts_at`, `row_count`, `seats_per_row`. `CHECK (drop_at < starts_at)`, 1–100 rows and 1–100 seats per row. |
| `zones` | A price for a range of rows. Rows are stored as numbers (A = 0); the API speaks letters. `price_agorot >= 0`, and names are unique per event. |
| `seats` | **Every seat exists as a row**, created with the event in the same transaction. That is what makes row locks possible. `UNIQUE (event_id, label)`. `status` is `AVAILABLE` / `HELD` / `SOLD`, and `hold_id` + `held_until` say who holds it and until when. A CHECK says a HELD seat always has both. |
| `fans` | `display_name` (can repeat) and `handle` (`UNIQUE`, never reused: it owns orders). |
| `holds` | `fan_id`, `event_id`, `status` (`ACTIVE` / `RELEASED` / `CONVERTED`), `expires_at`. Indexed by `(fan_id, event_id)` for rule 4. |
| `hold_seats` | Which seats a hold took. Needed because `seats.hold_id` is overwritten when an expired seat is held again. |
| `orders` | **`UNIQUE (hold_id)`**: one order per hold, enforced by the database. Also `subtotal_agorot`, `promo_code`, `discount_agorot`, `total_agorot`, with `CHECK (total = subtotal − discount)`, and a **partial unique index** `(fan_id) WHERE promo_code = 'WELCOME20'`: WELCOME20 once per fan, enforced by the database. |
| `order_items` | **`UNIQUE (seat_id)`**: a seat can be sold once, enforced by the database even if the code had a bug. |
| `idempotency_keys` | `PRIMARY KEY (fan_id, key)`, `request_hash`, the stored status and body. |

Money is **whole agorot** (`int`), never floats. Migrations are hand-written SQL (`api/src/database/migrations`), run automatically at startup (`migrationsRun`, one transaction each). `synchronize` is off.

## Double-selling: exactly how it's prevented
1. **Row locks in a fixed order.**
   - Every hold locks the fan row, then its seats `ORDER BY id`, with `SELECT ... FOR UPDATE`, in **one transaction**.
   - With 50 requests for B7, the first one locks the row. The other 49 wait, and once it commits each of them re-reads B7, sees it HELD, and gets `409 SEAT_TAKEN`.
   - Because every request locks in the same order, two requests can't wait for each other: **no deadlocks**. If PostgreSQL ever reports one anyway (`40P01`), the API answers `503 BUSY_TRY_AGAIN` with `Retry-After` instead of crashing.
2. **The check and the write happen under the same locks**, so nothing can change in between.
3. **Database safety nets:** `order_items UNIQUE (seat_id)` and `orders UNIQUE (hold_id)`.
4. **Checkout** locks the fan row, then the hold row, then its seats in id order, checks that every seat still points to this hold, and only then sells.
   - Ten checkouts of one hold make **one** order: the other nine get the same order (200).
5. **Proved by E2E tests on a real PostgreSQL** (`api/test/concurrency.e2e-spec.ts`):
   - 50 fans and one seat → exactly one 201 and 49 × 409.
   - One fan sends 10 parallel holds → exactly 4 succeed.
   - 20 pairs of opposite-order requests finish fast with one winner each.
   - The same Idempotency-Key ×10 → one hold.
   - 20 parallel "best available" requests → no seat appears twice.
   - 10 parallel checkouts → one order.

### How expiry works (rule 5)
**Nothing waits for a cleanup job. Expiry is a comparison with the database clock:**
- A seat counts as free when `status = 'AVAILABLE'`, or when `status = 'HELD' AND held_until <= now()`. The hold check uses this rule, and the seat map shows such seats as AVAILABLE the instant the hold ends (not just within 5 seconds).
- Checkout fails with **410 `HOLD_EXPIRED`** when `expires_at <= now()`.
- Rule 4 counts only holds with `expires_at > now()`.
- Releasing or checking out an old, expired hold never touches seats another fan has held since: only seats whose `hold_id` is still this hold are changed.

**One clock:** "now" is always PostgreSQL's clock (`DbClock`), never the API machine's clock, so several API copies agree. Responses include `serverNow`, so the screen's countdowns don't trust the fan's computer clock.

**Read AFTER the locks, with `clock_timestamp()`.** Inside a transaction, PostgreSQL's `now()` is frozen at the moment the transaction *started*. A checkout that started 1 s before the expiry but waited 3 s for a lock would decide with a time 3 s old and sell an expired hold; a hold that waited in line would lose its waiting time. So every service takes all its locks first, then reads `clock_timestamp()` (the real time at that moment) and decides with it: `expiresAt` starts then, and checkout compares with it. `api/test/clock-under-locks.e2e-spec.ts` holds a lock from a second connection to prove both cases.

## Extra credit
- **No lone seats** (`NO_LONE_SEATS=true`).
  - A pure function, `loneSeatsLeft(row, taking)`, finds free seats that would end up between two blocked sides (a taken seat or the end of the row). Seats that were already alone are ignored, as the brief says.
  - For a clicked hold, it is one more link in the chain (`NoLoneSeatsCheck`, 409 `LONE_SEAT`, naming the seat). For best available, `findBestBlock` skips such blocks, so the brief's example gives **C4–C5**.
  - **The whole row is locked**, not only the requested seats. Otherwise two fans taking A1 and A3 of a 3-seat row at the same moment would each see A2 "with a free neighbour" and together leave it alone. An E2E test sends exactly that and expects one 201 and one 409.
- **Promo codes** (`orders/promo`).
  - Each code is a **Strategy** (`PercentOff`, `FixedOffOnce`). Checkout only asks "how much off?".
  - SAVE10's discount is rounded half up with whole numbers only: `floor((subtotal × 10 + 50) / 100)`. ₪349.35 → discount ₪34.94 → total ₪314.41. The discount is capped at the subtotal, so a total is never below 0.
  - WELCOME20, once per fan ever: checkout now **locks the fan row first** (the same first lock as a hold), so two checkouts of one fan run one after the other and the second sees the first order. The partial unique index is the database's safety net. It is "used" only by an order row, so a failed checkout never burns it.
- **Admin screen** (`/admin`): a form over the same `POST /api/events`. The rules live in a pure, tested helper (`web/src/lib/eventForm.ts`); the server validates everything again (zone gaps and overlaps come back as readable messages).

## Patterns
- **Chain of Responsibility** (`common/chain/check.ts`).
  - Used for hold checks (`holds/checks/hold-chain.ts`) and checkout checks (`orders/checks`).
  - Each link is one small pure class, unit tested alone, and the data the links need is loaded first.
  - A new rule is one more link: "no lone seats" was added exactly that way, without touching the other checks.
- **Strategy** (`holds/selection`): how the seats are chosen.
  - `ExplicitSeatsStrategy` holds the seats the fan clicked.
  - `BestAvailableStrategy` handles "N together". It locks the candidates, then runs the pure `findBestBlock`.
  - Everything after the choice is shared.
  - Promo codes use the same idea: one class per kind of discount.
- **Idempotency-Key** (`idempotency/idempotency.service.ts`). It runs in the same transaction as the work, so a failed request never "uses up" its key, and concurrent duplicates wait on the primary key, then replay.

## Assumptions (where the brief was silent)
- **Fans:** a name gives a NEW fan with a handle like `dana#4821`. That is 4 random digits, retried on collision, then 6 digits after 5 collisions.
  - Two Danas are two fans. A handle (any case) logs back in. Handles are never reused.
  - Every fan request sends `X-Username: <handle>`.
  - This is identification, not authentication, as the brief asks.
- **Zones:** every row must be in exactly one zone. Gaps, overlaps, missing rows and reversed ranges are rejected, with all problems reported at once.
- **Limits:** 1–100 rows and 1–100 seats per row. After row Z come AA, AB.... Prices are whole agorot. Seat labels are case-insensitive (`b7` = `B7`), and `B07` is not a label.
- **Drop time:** the sale is open from exactly `dropAt` (`now >= dropAt`). Holding earlier gives **403 `SALE_NOT_OPEN`**, with `secondsLeft`. Viewing never needs a login.
- **Holds:** 1–4 seats per request (fixed by the brief); the per-fan limit is configurable.
  - The same seat twice → 400 `DUPLICATE_SEATS`.
  - An unknown seat → 400 `SEAT_NOT_FOUND`.
  - Both `seats` and `bestAvailable` in one request → 400 `INVALID_HOLD_REQUEST`.
- **A hold can't grow.** To change the seats, the fan releases and holds again. Adding seats to a running hold would raise hard questions: does the timer restart (then a fan could keep seats forever by adding one every 5 minutes)? The trade-off: on release, someone else can grab the seats. The API already allows a second, separate hold (rule 4 counts all of them); the screen shows one hold at a time to keep one timer and one checkout.
- **Release:**
  - Another fan's hold → **404** (we don't confirm it exists).
  - An expired or already-released hold → 204, and nothing changes.
  - A bought hold → 409.
- **Checkout:**
  - Another fan → **403 `NOT_YOUR_HOLD`** (the brief says only the holder can check out).
  - Released → 409.
  - Expired → **410 Gone**.
  - Repeated → 200 with the same order.
- **Best available:** when no N side-by-side seats match → **409 `NO_SEATS_TOGETHER`**.
  - Ties go to the lower first seat.
  - The filters are optional `maxPriceAgorot` and `zone`.
  - Because the most central block is picked first, an 8-seat row fits only 3 pairs (seats 1 and 8 are left alone), unless `NO_LONE_SEATS` is on.
- **No lone seats is a switch, off by default.** The brief's rule 7 example expects B2–B3 and the extra credit expects C4–C5 for the same hall, so both can't be on at once. The required rule wins by default; `NO_LONE_SEATS=true` turns the extra credit on (compose passes it through like `HOLD_TTL_SECONDS`).
- **Promo codes:**
  - Any letter case (`save10` = `SAVE10`).
  - An unknown code → **400 `PROMO_CODE_UNKNOWN`**. WELCOME20 a second time → **409 `PROMO_CODE_USED`**. In both cases nothing is sold and the hold stays, so the fan can check out without the code.
  - Checking out an already-bought hold returns the same order with its original discount, whatever code is sent the second time.
  - A failed checkout (expired, not your hold, unknown code) never uses up WELCOME20.
- **Idempotency-Key** is optional, per fan, and 1–100 characters.
  - A replay returns 200 with an `Idempotent-Replayed: true` header.
  - Errors are not stored, so the fan can retry with the same key.
- **Demo event:** created at startup when there are no events (`SEED_DEMO_EVENT=true`). A PostgreSQL advisory lock stops several copies from seeding twice.

## Stack choices and libraries
- **API:** NestJS 12 + TypeScript (strict, ESM), the framework the team uses.
  - TypeORM 1 is used for the connection, the entities and the migration runner. The concurrency-critical paths are **explicit, parameterized SQL**, so every lock is visible.
  - `class-validator` validates bodies and config, and Swagger reads it too.
  - `@nestjs/swagger` serves `/docs` and `/docs-json`.
- **Tests:** Vitest (the NestJS 12 default) and supertest.
  - E2E tests use **Testcontainers**, so every test file gets its own fresh PostgreSQL 17 and needs no manual steps.
  - The web app's helpers are tested with Vitest too.
- **Web:** React 19 + Vite + TypeScript, MUI, Redux Toolkit + RTK Query (polling, cache tags), React Router.
- **Lint:** oxlint, with `no-explicit-any` as an error.
- **Docker:** multi-stage images that run as non-root. The web app is served by unprivileged nginx, which proxies `/api`.
- **Infrastructure:**
  - `docker compose up` needs **no `.env`**, because every variable has a default.
  - The database is published on host port **55432**: 5432 and 5433 were already taken on the dev machine.
  - Healthchecks gate the start order: db → api → web.
- `npm audit`: 0 issues in production dependencies. The dev-only `picomatch` findings are not "fixed" with `--force`, because that would downgrade Vitest.

## What I'd change before a real launch
- **Real authentication** (OAuth or passwordless email) instead of a handle in a header, plus rate limiting per fan and per IP.
- **A waiting room / queue in front of the drop**, so 100k clicks become a steady flow.
- **Push instead of polling** (SSE or WebSockets) for seat updates.
- **A cleanup job and partitioning:** expiry is correct without one, but a job would keep the `seats` table tidy and data volumes small.
- **Scaling the database:** tune the connection pool, add PgBouncer, add read replicas for the seat map and events list, and cache the seat map for 1–2 seconds.
- Observability (metrics on lock waits and 409/503 rates), load tests, real payments with webhooks, and audit logs.

## Two short answers
**What breaks first if 100,000 fans arrive in the first minute?**
- The **database connection pool and the lock queues**. Every hold is a short transaction that holds a connection while it waits for row locks.
  - What is locked is wider than one seat: a clicked hold locks the **whole row** (for no-lone-seats), and best available locks **every seat that matches its filters** (often several rows), to choose safely.
  - So in a rush, requests for the same rows (and every best-available request for the same zone) queue behind each other, the pool runs out, and latency grows until requests time out.
- Seat-map polling (every fan, every 2 s) adds a heavy read load.
- Correctness holds: still no double-selling. What suffers is speed.
- The fixes are a queue or waiting room, a bigger pool with PgBouncer, a cached or pushed seat map, and per-fan rate limits.

**Does the protection still work with 3 copies of the API?**
- **Yes.** All protection is inside PostgreSQL: row locks, UNIQUE constraints, idempotency keys in a table, and the database clock. Nothing depends on the memory or clock of one API process.
- Three copies are three more clients of the same database, so the same locks serialize them. The demo seeder is also safe, thanks to a PostgreSQL advisory lock.
