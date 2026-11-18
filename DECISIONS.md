# DECISIONS

A living document: every stage adds to it. The sections follow the brief.

## Stack choices and libraries
- **Backend:** NestJS 12 with TypeScript `strict: true`. NestJS is the framework the team uses.
  - **Tests: Vitest.** It is the default test runner in NestJS 12, and the web app will use it too, so there is one runner for the whole repo.
  - **Lint: oxlint**, the NestJS 12 default, with `no-explicit-any` raised from "off" to "error" (no `any` in this codebase).
  - `strictPropertyInitialization` stays off, as NestJS sets it. DTO and entity fields are filled by the framework, not by a constructor, so TypeScript can't see that they get a value. The only alternative is a `!` on every field.
- **Database:** PostgreSQL 17 (the official Docker image). The ORM, TypeORM, comes in stage 1.
- **E2E tests** will run against a real PostgreSQL that Testcontainers starts (stage 0c). Every run gets a clean database and needs no manual steps.
- **Frontend:** React + TypeScript (Vite), MUI, Redux Toolkit + RTK Query (stage 9).
- **Repo layout:** `/api` and `/web`, as the brief requires.
- **Removed from the NestJS starter:**
  - the `nest deploy` script and `@nestjs/mau`, a paid hosting platform we don't use
  - the generated `README.md` and `AGENTS.md` (vendor boilerplate)
- **`npm audit`:** 0 vulnerabilities in production dependencies.
  - The 11 "high" findings are all in dev tools (the Nest CLI, Vitest, Vite) and come from `picomatch`.
  - The flaw is a slow regex on glob patterns, and we only pass it patterns we wrote ourselves.
  - The suggested `npm audit fix --force` would downgrade Vitest to v3, which is a breaking change, so we don't run it.

## Architecture (so far)
- **`configureApp()`** (`api/src/app.setup.ts`) holds everything global: the `/api` prefix, validation, the error filter and Swagger. `main.ts` **and the E2E tests** both call it, so the tests run the same app as production.
- **Config fails fast.** Every env var is validated at startup (`api/src/config/env.validation.ts`). A bad value such as `HOLD_TTL_SECONDS=abc` stops the server with a message that lists every problem. Without this, it would break later, in the middle of a drop.
- **One error shape:** `{ statusCode, code, message, details, path, timestamp }`.
  - Services throw `DomainError(code, message, details)` and know nothing about HTTP.
  - The **error catalog** (`error-codes.ts`) maps each code to its HTTP status. TypeScript makes sure every code has one.
  - Nest's own errors (unknown route, broken JSON) get the same shape, with a code made from the status (`NOT_FOUND`).
  - Unexpected crashes are logged in full, but the client only gets a generic message: no SQL and no stack traces.
- **Validation:** `class-validator` checks both request bodies and config. It's one library, and Swagger understands it.
  - Unknown fields are rejected (`forbidNonWhitelisted`).
  - Errors list every field with its full path, for example `zones.0.priceAgorot`.
- **Docs:** interactive docs at `/docs`, OpenAPI JSON at `/docs-json`. API routes live under `/api`.

## Infrastructure
- `docker compose up` works on a fresh clone **without a `.env` file**, because every variable has a default (`${VAR:-default}`). The brief says "no manual steps".
- PostgreSQL is published on host port **55432**, not 5432, so it doesn't clash with a PostgreSQL that is already installed or running for another project.
  - This happened on the dev machine: 5432 was taken by a local PostgreSQL and 5433 by another project's container. A reviewer's machine can look the same.
  - The port can be changed with `DB_PORT`.
- `.gitattributes` stores text files with LF line endings, so files committed from Windows still work inside Linux containers.

## Double-selling (decided; built in stages 3–6)
- **Pessimistic locking.** One transaction runs `SELECT ... FOR UPDATE`, first on the fan's row and then on the seats, ordered by id. Because the lock order is always the same, two requests can't deadlock.
- **Safety nets in the schema:** `order_items UNIQUE(seat_id)` and `orders UNIQUE(hold_id)`.
- **Time comes from the database clock (`now()`).** Expiry needs no cleanup job, and it works with several copies of the API.

## Schema (so far)
- **`events`**: name, venue, `starts_at`, `drop_at`, `row_count`, `seats_per_row`. The CHECK `drop_at < starts_at` means tickets go on sale before the show.
- **`zones`**: `event_id`, name, `from_row`, `to_row`, `price_agorot`.
  - Rows are stored as numbers (A = 0), so they are easy to compare. The API speaks letters.
  - `price_agorot >= 0`, and zone names are unique per event.
- **`seats`**: `event_id`, `zone_id`, `row_index`, `seat_number`, `label` ("B7"), status `AVAILABLE | HELD | SOLD`.
  - `UNIQUE (event_id, label)` and `UNIQUE (event_id, row_index, seat_number)`: one B7 per event.
  - The first unique index also serves "all seats of an event".
- **All seats are created up front**, in the same transaction as the event: the event, its zones and its seats are saved together or not at all. This is what lets rule 6 lock real seat rows.
- **Migrations are hand-written SQL**, listed in `src/database/migrations/index.ts` and run automatically when the app starts (`migrationsRun`), one transaction each. `synchronize` is off: the schema only changes through reviewed migrations.

## Assumptions
- **Fan identity.** A fan types a name and gets a unique handle such as `dana#4821`.
  - The tag is 4 random digits. After 5 collisions it switches to 6 digits.
  - Two people named Dana are two different fans.
  - Handles are never released or reused, because a handle owns orders and tickets.
  - This is identification, not authentication: the brief asks for no passwords.
- **Every row must be in exactly one zone.** Otherwise a seat would have no price, or two prices. A gap, an overlap, a row outside the hall or a reversed range is rejected with its own code (`ZONES_GAP`, `ZONES_OVERLAP`, ...), and all problems are reported at once.
- **Size limits:** 1–100 rows and 1–100 seats per row (up to 10,000 seats). The brief's example hall has 2,000 seats. After row Z come AA, AB ..., like spreadsheet columns.
- **Prices are whole agorot** (`priceAgorot`, ₪300 = 30000), never floats, so there are no rounding errors.
- **Seat labels** are case-insensitive on input (`b7` = `B7`). Seat numbers start at 1, and `B07` is not a valid label.
- **The drop time must be before the show starts** (`INVALID_EVENT_TIMES`).
