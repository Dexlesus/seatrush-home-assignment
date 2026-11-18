# AI_LOG

**Tool:** Claude Code (model: Claude Opus 5.5), inside VS Code.

## How I worked with it
- **Planning:** I made the decisions together with the AI: the locking approach, fan identity, the test database, the patterns my mentor asked for (Chain of Responsibility, Strategy, Idempotency-Key), and the fan-experience details.
- **Rules 1–2:** in small TDD steps. The AI wrote only the tests, I ran them in VS Code's Testing panel and saw them fail (red), then the AI wrote the code and I saw them pass (green).
- **Rules 3–8, screens and Docker:** the deadline was close, so my mentor asked me to have the AI build the rest in the same TDD style and to study the code with him after submitting. The git history shows the order: each `test: … (red)` commit comes before its `feat: … (green)` commit.

## Real examples: checked, changed, rejected

### Planning
- **Fan identity: changed after my question.** The AI first suggested a plain username in a header. I asked what happens when two different people both type "Dana". We changed it to a unique handle, `dana#4821`.
- **Releasing handles: my idea, rejected.** I suggested freeing a handle's number when a fan leaves or buys, so it could be reused.
  - The AI pointed out that a reused handle would show the old fan's tickets to the new fan, and that the server can't even tell when someone "left".
  - Handles stay permanent.
- **Locking: I chose from options.** The AI showed three ways to prevent double-selling: row locks, one conditional UPDATE, and SERIALIZABLE + retry. I picked row locks (`FOR UPDATE`) as the simplest to explain and verify.
- **Fan experience: my additions.**
  - A per-minute reminder while a hold runs. The AI suggested a banner that updates in place instead of a popup every minute, turning orange at 1:00 and red at 0:30.
  - The screen shows up front how many seats together are free, so a fan never clicks "3 together" only to fail.
- **SQL injection:** I asked whether every query is parameterized. We checked every `query(...)` call: user input only goes in as `$1, $2 …`, never pasted into SQL text.

### Things the tests caught in the AI's own code
- **Error path:** the error `path` used `request.url`, which came back as `/nope` instead of `/api/nope`. The E2E test failed, and it was fixed with `request.originalUrl`.
- **Missing library in unit tests:** the config unit test crashed with `Reflect.getMetadata is not a function`. Unit tests run without NestJS, which normally loads `reflect-metadata`, so it is now loaded in the Vitest setup.
- **A wrong expectation in a test (rule 7):** the AI expected 20 fans asking for "2 together" in a 5 × 8 hall to all succeed. The real result was 15.
  - Best available takes the central pair first (4–5), then 2–3, then 6–7, which leaves seats 1 and 8 alone. Only 3 pairs fit per row.
  - The code was right and the test was wrong. The test now checks the true outcome (15 winners, 5 × `NO_SEATS_TOGETHER`, no seat twice), and the "lone seats" effect is documented.
- **React lint:** oxlint flagged `setState` inside effects and a ref read during render on the event page. The AI rewrote it to derive the shown hold and the "someone just took it" seats while rendering, instead of syncing state in effects.

### Environment surprises
- **Port collision:** the first `docker compose up` failed. Port 5433 was taken by another project's container, and 5432 by a local PostgreSQL. We moved to **55432**, and the reason is written in DECISIONS (a reviewer's machine can look the same).
- **NestJS 12 defaults:** the generated project used Vitest and oxlint instead of Jest and ESLint, and ESM imports. We kept the new defaults.
  - We removed starter files we didn't need: a vendor README, an `AGENTS.md` with ads for a paid service, and a paid deploy tool.
- **`npm audit`:** 11 "high" findings, all in dev tools. The AI advised against `npm audit fix --force`, because it would downgrade Vitest.

## My review
_(I fill this in after going through the code with my mentor.)_
