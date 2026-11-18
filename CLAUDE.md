# CLAUDE.md

Guidance for Claude Code when working in this repository. Follow these rules unless the user explicitly says otherwise.

## Project Overview

Full-stack TypeScript application.

| Layer      | Tech                                                        |
|------------|-------------------------------------------------------------|
| Frontend   | React + TypeScript (Vite), MUI, Redux Toolkit + RTK Query   |
| Backend    | NestJS (TypeScript), TypeORM                                |
| Database   | PostgreSQL                                                  |
| Infra      | Docker Compose (db + backend + frontend)                    |

```
.
├── backend/              # NestJS API
├── frontend/             # React SPA
├── docker-compose.yml
├── .env.example          # every env var, with safe defaults
└── README.md             # run instructions + design decisions
```

## Commands

> Keep this section in sync with the real `package.json` scripts.

```bash
# Whole stack (from repo root)
docker compose up --build          # build & run everything
docker compose down -v             # stop & wipe DB volume

# Backend (cd backend)
npm run start:dev                  # watch mode
npm run lint && npm run typecheck
npm run test                       # unit tests
npm run test:e2e                   # e2e against real Postgres
npm run migration:generate -- src/database/migrations/<Name>
npm run migration:run
npm run migration:revert
npm run seed                       # dev seed data

# Frontend (cd frontend)
npm run dev
npm run lint && npm run typecheck
npm run test                       # Vitest + React Testing Library
npm run build
```

## Golden Rules (always)

- **TypeScript `strict: true` everywhere.** No `any` — use `unknown` + narrowing, generics, or proper types.
- **Definition of done:** lint, typecheck and tests pass, and `docker compose up --build` works from a clean clone.
- **Never commit secrets.** All config comes from env vars; update `.env.example` whenever you add one.
- **Small, focused changes.** Don't refactor or reformat unrelated code.
- **Ask before assuming** when a requirement is ambiguous; don't invent business rules.
- **No `console.log`** left in committed code (backend uses Nest `Logger`).
- Prefer editing existing files and following existing patterns over introducing new ones.

## Feature Workflow (backend → frontend)

1. Entity (+ DB constraints & indexes)
2. Migration (generate, review the SQL, run)
3. DTOs (request + response)
4. Service + unit tests
5. Controller + e2e test
6. RTK Query endpoint in the frontend
7. UI (handle loading / error / empty / success)

---

## Backend — NestJS

### Structure: one module per feature

```
backend/src/
├── main.ts                  # bootstrap: global pipes, filters, prefix, CORS, Swagger
├── app.module.ts
├── config/                  # ConfigModule + env validation schema
├── common/                  # filters, interceptors, guards, decorators, pipes
├── database/
│   ├── data-source.ts       # single DataSource config (app + CLI)
│   ├── migrations/
│   └── seeds/
└── modules/
    └── <feature>/
        ├── <feature>.module.ts
        ├── <feature>.controller.ts
        ├── <feature>.service.ts
        ├── <feature>.service.spec.ts
        ├── entities/<feature>.entity.ts
        └── dto/
            ├── create-<feature>.dto.ts
            ├── update-<feature>.dto.ts
            ├── query-<feature>.dto.ts      # pagination / filters
            └── <feature>-response.dto.ts
```

### Layer responsibilities

- **Controllers are thin:** routing, DTO binding, HTTP status codes. No business logic, no repository access.
- **Services own business logic.** Inject repositories with `@InjectRepository(Entity)`.
- **Never return entities directly.** Map to a response DTO (explicit mapper function or `ClassSerializerInterceptor` + `@Exclude/@Expose`). Never expose internal fields (passwords, internal flags).
- Use dependency injection for everything; no `new SomeService()`.
- Keep modules decoupled: export only what other modules need.

### Validation & config

- Global pipe in `main.ts`:
  ```ts
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  ```
- Every request body/query has a DTO with `class-validator` decorators. Use `PartialType` / `PickType` / `OmitType` instead of duplicating DTOs.
- Query params (pagination, filters) are DTOs too, using `@Type(() => Number)` for numbers.
- `@nestjs/config` with a validation schema (Joi or zod) — **fail fast on startup** if env is invalid. Access config via `ConfigService`, never `process.env` scattered in code.

### Error handling

- Throw Nest's built-in exceptions from services: `NotFoundException`, `BadRequestException`, `ConflictException`, `ForbiddenException`, `UnprocessableEntityException`.
- One global exception filter → consistent error shape:
  ```json
  { "statusCode": 404, "error": "Not Found", "message": "...", "path": "/api/...", "timestamp": "..." }
  ```
- Map Postgres errors in the filter: `23505` (unique violation) → 409, `23503` (FK violation) → 409/400.
- Never leak stack traces, SQL, or internal messages to the client.

### API conventions

- Global prefix `/api`. REST, plural nouns: `GET /api/users`, `GET /api/users/:id`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`.
- Status codes: `201` create, `200` read/update, `204` delete, `400` validation, `404` not found, `409` conflict.
- Validate path ids: `@Param('id', ParseUUIDPipe)`.
- List endpoints are always paginated, with a max `limit` (e.g. 100):
  `{ items: T[], total: number, page: number, limit: number }`.
- Swagger via `@nestjs/swagger` at `/api/docs`; decorate DTOs with `@ApiProperty`.
- CORS allows only the frontend origin from env.
- Health endpoint `GET /api/health` (`@nestjs/terminus`, checks DB) — used by the Docker healthcheck.

### TypeORM

- **`synchronize: false` — always.** Schema changes only through migrations. Review every generated migration before committing.
- One `data-source.ts` shared by the app and the TypeORM CLI. Use `autoLoadEntities: true` in the app.
- Run migrations on backend startup (`migrationsRun: true`) or as an explicit compose step — the stack must come up with a ready schema.
- Entity conventions:
  - `@PrimaryGeneratedColumn('uuid')`
  - `@CreateDateColumn({ type: 'timestamptz' })`, `@UpdateDateColumn({ type: 'timestamptz' })`
  - snake_case DB names (`SnakeNamingStrategy` or explicit `name:`), camelCase in TS.
  - `@Index()` on foreign keys and frequently filtered/sorted columns.
- **Money:** never `float`. Use `numeric(precision, scale)` with a transformer, or integer minor units (cents) as `bigint`.
- **Relations:** no `eager: true`. Load explicitly with `relations` / `QueryBuilder` joins. Watch for N+1.
- **Transactions:** any operation that writes more than one row/table runs in a transaction:
  ```ts
  await this.dataSource.transaction(async (manager) => {
    // use `manager` here — NOT the injected repositories
  });
  ```
- **Concurrency:** for balances/counters/inventory use `lock: { mode: 'pessimistic_write' }` inside a transaction, or `@VersionColumn` for optimistic locking. Prefer atomic SQL updates (`SET x = x + :delta`) over read-modify-write.
- **Raw SQL:** parameters only (`:param` / `$1`). Never interpolate user input.
- Select only needed columns for heavy list queries.

### Backend testing

- **Unit:** services with mocked repositories via `getRepositoryToken(Entity)`. Cover happy path + not found + validation + conflict.
- **e2e:** `supertest` against a real Postgres (separate test DB/container), migrations run before the suite, data cleaned between tests.
- Test business-critical edge cases explicitly (concurrency, boundaries, invalid state transitions).

---

## Frontend — React + TypeScript

### Tooling

- Vite + React + TypeScript strict. ESLint + Prettier.
- Vitest + React Testing Library (test behavior, not implementation; query by role/label).
- Env vars via `import.meta.env.VITE_*` (e.g. `VITE_API_URL`), typed in `vite-env.d.ts`.

### Structure: feature-based

```
frontend/src/
├── main.tsx                # Provider, ThemeProvider, CssBaseline, Router
├── App.tsx
├── app/
│   ├── store.ts            # configureStore
│   └── hooks.ts            # typed useAppDispatch / useAppSelector
├── api/
│   └── baseApi.ts          # RTK Query createApi + fetchBaseQuery + tagTypes
├── features/
│   └── <feature>/
│       ├── <feature>Api.ts       # baseApi.injectEndpoints(...)
│       ├── <Feature>Page.tsx
│       ├── components/
│       ├── hooks/
│       └── types.ts
├── components/             # shared, presentational UI
├── theme/theme.ts
├── routes/
└── utils/
```

### State management

- **Server state → RTK Query.** Caching, loading/error flags, and invalidation via `providesTags` / `invalidatesTags`.
  - Never `fetch`/`axios` inside `useEffect` for server data.
  - Never copy server data into a Redux slice.
- **UI state → `useState` / `useReducer` first.** A Redux slice only for truly global client state (auth session, cross-page filters, UI preferences).
- Use only the typed hooks from `app/hooks.ts`.
- Types for API responses mirror backend response DTOs (keep them in `types.ts`; consider a shared types package if it grows).

### Components

- Function components + hooks. Type props with `type Props = {...}`; no `React.FC`.
- Keep components small; move logic into custom hooks (`useXxx`).
- **Every data view handles 4 states:** loading (`Skeleton` / `CircularProgress`), error (`Alert` + retry), empty (meaningful message), success.
- List keys are stable ids — never array index.
- Lazy-load route pages (`React.lazy` + `Suspense`); one top-level error boundary.
- Memoize (`useMemo`, `useCallback`, `React.memo`) only when there's a measured reason.

### Forms

- `react-hook-form` + `zod` resolver (or controlled MUI inputs for tiny forms).
- Client validation mirrors backend DTO rules, but the backend is the source of truth — display server validation errors on the relevant fields.
- Disable submit while a mutation is pending; prevent double submission.
- Success/error feedback via `Snackbar`.

### MUI

- One theme: `createTheme` → `ThemeProvider` + `CssBaseline` at the root.
- Style with the `sx` prop or `styled()`; use theme tokens (`theme.spacing`, `palette`, `typography`) — **no hard-coded colors or pixel values**.
- Layout with `Stack`, `Box`, `Grid`; tables with `Table` or MUI X `DataGrid` (server-side pagination for large data).
- Accessibility: every input has a `label`; icon-only buttons have `aria-label`; dialogs have titles.

---

## Database — PostgreSQL

- **Enforce integrity in the DB, not only in code:** `NOT NULL`, `UNIQUE`, foreign keys with explicit `ON DELETE`, `CHECK` constraints (e.g. `amount > 0`).
- snake_case, plural table names; `uuid` PKs; `timestamptz` for all timestamps (store UTC).
- Index foreign keys and columns used in `WHERE` / `ORDER BY` / joins.
- Soft delete (`@DeleteDateColumn`) only when the domain requires history.
- Provide a seed script with realistic dev data.

---

## Docker Compose

```yaml
services:
  db:
    image: postgres:17-alpine
    env_file: .env
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build: ./backend
    env_file: .env
    environment:
      DB_HOST: db            # service name, NOT localhost
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3000:3000"

  frontend:
    build: ./frontend
    depends_on:
      - backend
    ports:
      - "5173:80"

volumes:
  pgdata:
```

Rules:
- **Multi-stage Dockerfiles** (deps → build → slim runtime). Use `npm ci`. Run as non-root (`USER node`) in the final stage.
- `.dockerignore` excludes `node_modules`, `dist`, `.env`, `.git`, coverage.
- Inside the compose network, services reach each other by service name (`db`, `backend`).
- Frontend production image: static build served by nginx; nginx proxies `/api` → `backend:3000` (avoids CORS issues).
- Backend runs migrations before serving traffic.
- **`docker compose up --build` on a fresh clone must work with zero manual steps** (copying `.env.example` → `.env` is the only allowed step, and it must be documented).

---

## Git & Documentation

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`. One logical change per commit.
- `README.md` must include: how to run, how to run tests, architecture overview, key design decisions & trade-offs, and what you'd improve with more time.

## Don't

- Don't use `any`, `@ts-ignore`, or disable ESLint rules to silence errors.
- Don't enable TypeORM `synchronize` or edit a migration that has already been applied — create a new one.
- Don't put business logic in controllers or React components.
- Don't return TypeORM entities from controllers.
- Don't fetch server data in `useEffect` or duplicate it into Redux slices.
- Don't hard-code URLs, credentials, ports, or colors.
- Don't use floats for money.
- Don't add new dependencies without a clear reason — prefer what's already in the stack.
