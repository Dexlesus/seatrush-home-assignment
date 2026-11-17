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

## Assumptions
- **Fan identity.** A fan types a name and gets a unique handle such as `dana#4821`.
  - The tag is 4 random digits. After 5 collisions it switches to 6 digits.
  - Two people named Dana are two different fans.
  - Handles are never released or reused, because a handle owns orders and tickets.
  - This is identification, not authentication: the brief asks for no passwords.
