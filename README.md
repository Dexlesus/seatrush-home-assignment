# SeatRush

A ticket drop that is fair, fast, and never sells the same seat twice.
Fans wait for the drop, hold up to 4 seats for a few minutes, and buy them. Admins create events through the API.

- **API:** NestJS + PostgreSQL. All 8 rules, each covered by unit tests and E2E tests on a real PostgreSQL.
- **Web:** React + MUI + RTK Query. Login, events with countdowns, a live seat map, "best available", a hold countdown, checkout, and my tickets.
- **Extra credit:** no lone seats (`NO_LONE_SEATS=true`), promo codes at checkout (`SAVE10`, `WELCOME20`), and an **admin screen** to create events (http://localhost:5173/admin).

## Run it
```bash
docker compose up --build
```
No `.env` file and no other steps are needed. This starts:

| What | Where |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:3000/api |
| Interactive API docs (OpenAPI) | http://localhost:3000/docs. The JSON is at http://localhost:3000/docs-json |
| PostgreSQL | `localhost:55432` (user / password / db: `seatrush`) |

On a fresh start the API runs its migrations and creates **one demo event that is already on sale** ("SeatRush Live: Opening Night", 10 rows × 16 seats, 3 zones).

A short hold time, and the "no lone seats" extra credit switched on:
```bash
HOLD_TTL_SECONDS=20 MAX_SEATS_PER_USER=4 NO_LONE_SEATS=true docker compose up --build
```
Start clean (this deletes the data): `docker compose down -v`.

### Try it with two fans
1. Open http://localhost:5173 in **two browser windows**.
2. Pick a username in each, for example `Dana` and `Noa`. Each tab keeps its own fan.
3. In both windows, click the same seat and press **Hold**. One wins. The other sees *"Someone just took B3"*, and the map updates within 2 seconds.

## How fans are identified (no passwords)
1. `POST /api/session { "name": "Dana" }` creates a **new fan** with a unique handle such as `dana#4821` (**201**). Two people named Dana get two different handles.
2. `POST /api/session { "name": "dana#4821" }` logs that fan back in (**200**).
3. Every fan request sends the handle in a header: **`X-Username: dana#4821`**. A missing header gives 401 `IDENTITY_REQUIRED`, and an unknown handle gives 401 `UNKNOWN_FAN`.

In `/docs`, click **Authorize** and paste a handle to try the fan routes.

This is *identification*, not authentication: anyone who knows a handle can use it. The brief asks for no passwords. See *Known gaps*.

## API in one table
| Method and path | Who | What |
|---|---|---|
| `POST /api/events` | admin (no login) | Create an event: name, venue, times, rows, seats per row, zones (prices in agorot) |
| `GET /api/events` | anyone | Events with `saleOpen` and `serverNow` (for countdowns) |
| `GET /api/events/:id` · `/:id/seats` | anyone | An event and its zones · the seat map with each seat's status |
| `POST /api/session` | anyone | Log in by name or handle |
| `GET /api/me` | fan | Who am I |
| `POST /api/events/:id/holds` | fan | Hold `{ "seats": ["B1","B2"] }` or `{ "bestAvailable": { "count": 2, "maxPriceAgorot": 20000, "zone": "Floor" } }`. Optional `Idempotency-Key` header |
| `DELETE /api/holds/:holdId` | fan | Release early (owner only) |
| `GET /api/me/holds` | fan | My active holds |
| `POST /api/holds/:holdId/checkout` | fan | Buy, optionally `{ "promoCode": "SAVE10" }`. One order per hold; repeating it returns the same order |
| `GET /api/me/orders` | fan | My tickets |

Every error has the same shape, for example:
`{ statusCode: 409, code: "SEAT_TAKEN", message: "Someone just took B3.", details: { seats: ["B3"] }, path, timestamp }`.

## Environment variables
All of them are optional. The defaults are in [.env.example](.env.example).

| Variable | Default | Meaning |
|---|---|---|
| `HOLD_TTL_SECONDS` | `300` | How long a hold lasts (rule 3) |
| `MAX_SEATS_PER_USER` | `4` | Seats per fan per event, held and bought together (rule 4) |
| `NO_LONE_SEATS` | `false` | Extra credit: refuse holds that leave one seat stuck alone. Off by default, so rule 7's example still answers B2–B3 (on: C4–C5) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `localhost` / `55432` / `seatrush` ×3 | Database. Inside compose the API uses `db:5432` |
| `PORT` | `3000` | API port |
| `SEED_DEMO_EVENT` | `true` | Create the demo event when there are no events |
| `CORS_ORIGIN` | `http://localhost:5173` | The web origin allowed to call the API directly |

The API validates every variable at startup and refuses to start on a bad value (fail fast).

## How I worked
1. **A written plan before any code.**
   - The 8 rules from the brief, one stage each.
   - Three ways to prevent double-selling (row locks, one conditional `UPDATE`, `SERIALIZABLE` + retry), and the choice between them.
   - How fans are identified, and the schema.
   - An error catalog: every error code, with the sentence the fan sees for it.
2. **Test first, one rule at a time.** For each rule:
   - I wrote unit tests for the logic and E2E tests on a real PostgreSQL.
   - I ran them and saw them fail (red), then wrote the code until they passed (green).
   - The git history shows it: every `test: … (red)` commit comes before its `feat:` / `fix: … (green)` commit.
3. **Patterns only where they pay off:**
   - **Chain of Responsibility** for the hold and checkout checks: "no lone seats" was added as one more link.
   - **Strategy** for how seats are chosen, and for promo codes.
   - **Idempotency-Key** on hold and checkout.
4. **Then the screens, Docker and the extra credit**, in the same red-then-green way.
5. **Reviews, where every claim had to be proved by a failing test before anything changed:**
   - **My mentor's review:**
     - Two claims were real bugs. "now" was read before waiting for locks, so a checkout that waited could sell an expired hold. Both were fixed.
     - Two claims weren't bugs: their tests passed on the first run. They stay as tests.
   - **A production-readiness audit:** 11 possible problems, each rated 1–5. The three rated 3 or more were fixed, each one after a red test:
     - Waiting for a lock now has a time limit.
     - API copies run the migrations one at a time.
     - "Best available" locks one row, not the whole hall.
   - **The 20 manual checks** found 9 problems in what a person sees. Each was fixed or became a written decision. [MANUAL_TESTS.md](MANUAL_TESTS.md) lists them.
6. **AI:** I worked with Claude Code. [AI_LOG.md](AI_LOG.md) says where the AI wrote code, and what I checked, changed or rejected.

## How it was tested
| Layer | What it proves | How | Count |
|---|---|---|---|
| **Unit** (API) | The logic of every rule: pure functions, each check in the chain, the strategies, error mapping, config | Vitest, no database | 123 |
| **E2E** (API) | Every rule through HTTP on a **real PostgreSQL 17**, races included | Testcontainers: a fresh database per test file. `Promise.all` fires real races. A second database connection holds a lock to control the timing | 83 |
| **Web** | The screen helpers (errors, countdowns, the seat limit, money, the admin form) | Vitest + Testing Library | 39 |
| **Web screen tests** | The event page: a double click sends one hold, and hovering says "held" or "sold". A guard also fails if the source text has broken characters | A fake server behind the real page | (included in the 39) |
| **Rush script** | Rule 6 against the running containers | `node scripts/rush.mjs 200` | 200 fans |
| **Manual checks** | What a person sees: two windows, the countdown colours, double clicks, the server going down, the API docs | [MANUAL_TESTS.md](MANUAL_TESTS.md), with the result of each check | 20 |
| **CI** | Everything above except the manual checks, plus `docker compose up --build` from a clean checkout | GitHub Actions, on every push | — |

**Some of the E2E tests:**
- **50 fans, one seat:** exactly one wins, and 49 get `409`.
- **The same Idempotency-Key ×10 at once:** exactly one hold.
- **A lock that never comes free:** the waiting hold gets `503` in about 3 s, and the seat map still answers.
- **Three API copies starting at the same moment on an empty database:** all three come up.
- **A checkout that started before the expiry but waited past it:** `410`, and no order.

### Run the tests
Docker must be running. The E2E tests start their own throwaway PostgreSQL with **Testcontainers**, one per test file, and never touch your data.

```bash
cd api && npm ci
npm test            # unit tests (123): rules logic, chains, strategies, errors, config
npm run test:e2e    # E2E tests (83) on real PostgreSQL 17: rules 1–8, races, lock waits, startup, extra credit

cd ../web && npm ci
npm test            # web tests (39): screen tests of the event page + helpers
```

**Against the running stack** (after `docker compose up`):
```bash
node scripts/rush.mjs 200   # 200 fans click one seat at once → PASS: exactly 1 winner
```

Every rule has both kinds of tests:

| Rule | Unit tests | E2E tests |
|---|---|---|
| 1 Seat map | `events/domain/seat-map.spec.ts` | `test/events.e2e-spec.ts` |
| 2 Drop time | `holds/checks/sale-open.check.spec.ts` | `test/drop-time.e2e-spec.ts`, plus 403 in `holds` and `best-available` |
| 3 Holding (all or nothing, release, Idempotency-Key) | `seat-count`, `seats-exist`, `seats-available` checks, `hold-rules.spec.ts` | `test/holds.e2e-spec.ts` |
| 4 Per-fan limit | `holds/checks/fan-limit.check.spec.ts` | `test/fan-limit.e2e-spec.ts`, `test/fan-limit-env.e2e-spec.ts` |
| 5 Expiry | `seats-available` (expired = free), `checkout-checks.spec.ts` | `test/expiry.e2e-spec.ts` (TTL = 2 s, no cleanup job) |
| 6 Never sell twice | `postgres-errors.spec.ts`, `retryable-errors.spec.ts` | `test/concurrency.e2e-spec.ts` (50 fans, one seat, **exactly one wins**) |
| 7 Best available | `holds/domain/best-available.spec.ts` (**the brief's B2–B3 example**), `seat-selection.spec.ts` | `test/best-available.e2e-spec.ts` |
| 8 Checkout | `orders/checks/checkout-checks.spec.ts` | `test/checkout.e2e-spec.ts` |
| Extra: no lone seats | `holds/domain/lone-seats.spec.ts`, `no-lone-seats.check.spec.ts`, `best-available.spec.ts` (**C4–C5**) | `test/lone-seats.e2e-spec.ts` |
| Extra: promo codes | `orders/promo/promo-codes.spec.ts` (**₪349.35 → ₪314.41**) | `test/promo-codes.e2e-spec.ts` |
| Production safety | `postgres-errors.spec.ts` (lock / query time limits → retry) | `test/lock-timeout.e2e-spec.ts` (a stuck lock → 503 in 3 s, the seat map still answers), `test/startup.e2e-spec.ts` (3 API copies start at once), `test/clock-under-locks.e2e-spec.ts` |

Other checks: `npm run lint` and `npm run typecheck` in `api/` and `web/`.

## Key decisions
The full reasoning, with the trade-offs, is in [DECISIONS.md](DECISIONS.md). In short:

| Decision | Why |
|---|---|
| **Row locks (`SELECT … FOR UPDATE`), always in the same order:** the fan, then the seats' rows by id | Of the three options, it's the simplest to explain and to prove. The same order everywhere means no deadlocks. `UNIQUE` constraints are a second safety net |
| **The check and the write in one transaction**, under the same locks | Nothing can change between "is B7 free?" and "B7 is yours" |
| **Expiry is a comparison with the database clock, not a cleanup job** | A seat is free the moment its hold ends. The clock is read **after** the locks (`clock_timestamp()`), so time spent waiting in line doesn't count |
| **Fans get a handle like `dana#4821`**, sent in a header, and it's never reused | Two people named Dana are two fans. A reused handle would show the old fan's tickets to a new one |
| **The Idempotency-Key is saved in the same transaction as the work** | A failed request never "uses up" its key. Duplicates sent at the same moment wait, then get the same answer |
| **Time limits on lock waits** (3 s) and queries (10 s) | One stuck lock can't freeze the whole API. The fan gets "try again" |
| **"No lone seats" is a switch, off by default** | The brief's rule 7 example (B2–B3) and its no-lone-seats example (C4–C5) contradict each other for the same hall |
| **The seat map polls every 2 s** | Simple and enough for this scale. Push (SSE or WebSockets) is in "what I'd change" |
| **A hold can't grow:** release and hold again | Otherwise a fan could keep seats forever by adding one every 5 minutes |

## What I learned
- **A lock is not a hold.**
  - A hold is data in the seat's row, and it lasts 5 minutes. A `FOR UPDATE` lock lasts milliseconds, until the transaction commits.
  - A lock doesn't reject other requests, it makes them **wait**, and then they read the new value. That's exactly what stops double-selling.
  - It's also why a stuck lock needs a time limit: everyone behind it waits, and each of them holds a database connection while waiting.
- **In PostgreSQL, `now()` is the time the transaction started, not the time of the statement.** A request that waited for a lock was deciding with an old time. I only saw it with a test that holds a lock from a second connection.
- **A test has to fail first.** Twice a review claimed a bug and the test failed: real bugs. Twice the test passed on the first run: not bugs. Without the red step I couldn't have told them apart.
- **Races need race tests:** many requests at once with `Promise.all`, and a second connection that holds a lock at exactly the right moment.
- **Defaults that are fine in development can hurt in production.**
  - PostgreSQL waits for a lock forever.
  - TypeORM's migrations have no lock between API copies.
  - nginx waited about 40 s for a stopped container.
  - Each one was found by a test or a check, not by reading the code.
- **The manual checks find what the tests don't:** a tooltip covering a seat, a countdown that jumped, an HTML error page shown as "Something went wrong", docs forms that kept the previous fan's request.

## Project layout
```
api/   NestJS API: src/{events,fans,holds,orders,idempotency,common,config,database}, test/ (E2E)
web/   React app: src/{features,api,lib,app}
scripts/rush.mjs     live rule-6 check against the running stack (no packages)
docker-compose.yml   db + api + web, with healthchecks
MANUAL_TESTS.md      20 checks by hand, with the results and what they found
DECISIONS.md         architecture, schema, double-selling, assumptions, trade-offs
AI_LOG.md            how AI was used, and what I checked, changed or rejected
```

## Known gaps
- **No real authentication.** A handle in a header identifies a fan. Anyone who knows a handle can act as that fan.
- **Seat updates use polling** (every 2 s), not push (SSE/WebSockets).
- **No rate limiting**, and no waiting room for very large drops (see DECISIONS → *What breaks first*).
- **No lone seats is off by default** (see the env table): with it off, "best available" can leave single seats at the row ends.
- **Asking the API for a seat you already hold** says "Someone just took J1". "You already hold J1" would be friendlier. The screen never sends this request.
- **Promo codes are fixed in code** (`orders/promo/promo-codes.ts`), not managed from the admin screen.
- **The admin screen has no login**, like the API it calls (the brief: "no login, no roles").
- **Web tests are mostly the pure helpers**, plus one screen test of the event page (double click = one hold) with a fake server. There are no real-browser tests; [MANUAL_TESTS.md](MANUAL_TESTS.md) covers the screens by hand.
