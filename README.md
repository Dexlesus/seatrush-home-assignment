# SeatRush

A ticket drop that is fair, fast, and never sells the same seat twice.
Fans wait for the drop, hold up to 4 seats for a few minutes, and buy them. Admins create events through the API.

- **API:** NestJS + PostgreSQL. All 8 rules, each covered by unit tests and E2E tests on a real PostgreSQL.
- **Web:** React + MUI + RTK Query. Login, events with countdowns, a live seat map, "best available", a hold countdown, checkout, and my tickets.

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

A short hold time for testing:
```bash
HOLD_TTL_SECONDS=20 MAX_SEATS_PER_USER=4 docker compose up --build
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
| `POST /api/holds/:holdId/checkout` | fan | Buy. One order per hold; repeating it returns the same order |
| `GET /api/me/orders` | fan | My tickets |

Every error has the same shape, for example:
`{ statusCode: 409, code: "SEAT_TAKEN", message: "Someone just took B3.", details: { seats: ["B3"] }, path, timestamp }`.

## Environment variables
All of them are optional. The defaults are in [.env.example](.env.example).

| Variable | Default | Meaning |
|---|---|---|
| `HOLD_TTL_SECONDS` | `300` | How long a hold lasts (rule 3) |
| `MAX_SEATS_PER_USER` | `4` | Seats per fan per event, held and bought together (rule 4) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `localhost` / `55432` / `seatrush` ×3 | Database. Inside compose the API uses `db:5432` |
| `PORT` | `3000` | API port |
| `SEED_DEMO_EVENT` | `true` | Create the demo event when there are no events |
| `CORS_ORIGIN` | `http://localhost:5173` | The web origin allowed to call the API directly |

The API validates every variable at startup and refuses to start on a bad value (fail fast).

## Tests
Docker must be running: the E2E tests start their own throwaway PostgreSQL with **Testcontainers**, one per test file, and never touch your data.

```bash
cd api && npm ci
npm test            # unit tests (98): rules logic, chains, strategy, errors, config
npm run test:e2e    # E2E tests (60) against real PostgreSQL 17, rules 1–8 and concurrency

cd ../web && npm ci
npm test            # web helper tests (21): friendly errors, countdowns, seats together, money
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

Other checks: `npm run lint` and `npm run typecheck` in `api/` and `web/`.

## Project layout
```
api/   NestJS API: src/{events,fans,holds,orders,idempotency,common,config,database}, test/ (E2E)
web/   React app: src/{features,api,lib,app}
docker-compose.yml   db + api + web, with healthchecks
DECISIONS.md         architecture, schema, double-selling, assumptions, trade-offs
AI_LOG.md            how AI was used, and what I checked, changed or rejected
```

## Known gaps
- **No real authentication.** A handle in a header identifies a fan. Anyone who knows a handle can act as that fan.
- **Seat updates use polling** (every 2 s), not push (SSE/WebSockets).
- **No rate limiting**, and no waiting room for very large drops (see DECISIONS → *What breaks first*).
- **The extra credit (no lone seats, promo codes) is not implemented.** "Best available" can therefore leave single seats at the row ends.
- **No admin screen.** Admins use the API or `/docs`.
- **Web tests cover the pure helpers.** There are no component or browser tests.
