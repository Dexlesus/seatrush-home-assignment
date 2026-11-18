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

### Extra credit
- **Choosing the "anything else" item: my choice.** The AI offered 5 ideas (admin screen, QR tickets, live updates with SSE, a waitlist, a rush simulator), with the cost of each. I picked the admin screen: small, it reuses `POST /api/events`, and reviewers can use it to make an event that drops in 1 minute. The rush script was kept small, as a tool for the manual tests.
- **Two rules that contradict each other.** The brief's rule 7 example expects B2–B3, and the "no lone seats" example expects C4–C5 for the same hall. We made no-lone-seats a switch (`NO_LONE_SEATS`, off by default), so the required rule wins by default and the reviewer can turn the extra on.
- **A race the first idea missed.** Locking only the requested seats is not enough for no-lone-seats: two fans taking A1 and A3 at the same moment would together leave A2 alone. The fix is to lock the whole row, and there's an E2E test that sends exactly that race.
- **Found by the manual tests.** Writing check 20 (API down), we found that nginx answers with an HTML 502 page. The screen would say "Something went wrong" instead of "We can't reach the server", and without a "Try again" button. Fixed with a test first.

### A second review (another AI tool), checked point by point
My mentor ran a second review. I didn't accept its list as is: for each point, a test had to show the bug first.
- **Real bug: checkout after the expiry.** PostgreSQL's `now()` is the start of the transaction. A test holds the fan's lock from a second connection, starts a checkout before the expiry, and lets it go after: the old code answered **201 and created an order for an expired hold**. Fixed by reading `clock_timestamp()` after all locks. The test now gets 410.
- **Real bug: a waiting hold lost its waiting time.** The same kind of test showed a hold that waited 1.5 s expired 1.5 s early. Fixed the same way.
- **Not a bug: replaying an expired hold.** The test passed on the first run: the replay returns the same (expired) hold and never takes the seats back from the new holder. Kept as a test.
- **Not a bug: double click.** A screen test with a fake server double-clicks "Hold" and counts the requests: 1. To be sure the test can catch the bug, I removed the "disabled while busy" guard for a moment: it went red with 2 requests.
- **Docs were wrong:** DECISIONS said `now()` was "now" inside a transaction, and said only single seats are locked. Both are corrected.

### A production-readiness audit (AI review, then test first)
- I asked the AI to review the project for production bugs and give me a table: the risk of each finding, the checks it needs, whether a test is easy, and its importance from 1 to 5. It found 11 findings, none critical.
- I asked for every finding rated 3 or more to be fixed, each with a test that proves the bug first.
  - **No time limit on lock waits (4).**
    - **The red test:** a second connection holds a fan's lock and never lets go. The fan's hold got no answer for 8 s. With 12 such holds, even the seat map stopped answering, because they used up all 10 database connections.
    - **The fix:** `lock_timeout` 3 s and `statement_timeout` 10 s. The stuck hold now gets `503` in 3 s, and the retry with the same key works.
    - **Before the fix, I asked:** if `FOR UPDATE` locks the row, how can 10 requests reach it at all? The answer, that a lock makes others *wait* rather than rejecting them, is now in the README's *What I learned*.
  - **Migrations from several API copies (3).**
    - **The red test:** start 3 copies at once on an empty database. 2 of them crashed (`duplicate key … pg_class_relname_nsp_index`).
    - **The AI's first claim was too strong.** It said a crashed copy "stays down". The test showed that `@nestjs/typeorm` retries after 3 s and the copy comes up. The crash is real; the damage was smaller than claimed.
    - **The fix:** an advisory lock around the migrations.
  - **"Best available" locked the whole hall (3).**
    - **The red test:** a hold in a different row waited more than 2 s for a best-available request.
    - **The fix:** look without locks, lock only the chosen row, and use a savepoint to let go of that row and try again if the block was taken in between.
    - **Before relying on the savepoint,** the AI checked in PostgreSQL that rolling back to a savepoint really releases row locks, with a control run that showed the lock is kept without it. One more test makes sure the fallback path is really reached.
- **The final manual run found one more thing:** with the API stopped, nginx waited about 38 s. `proxy_connect_timeout 3s` brought it down to 3 s.

### Environment surprises
- **Port collision:** the first `docker compose up` failed. Port 5433 was taken by another project's container, and 5432 by a local PostgreSQL. We moved to **55432**, and the reason is written in DECISIONS (a reviewer's machine can look the same).
- **NestJS 12 defaults:** the generated project used Vitest and oxlint instead of Jest and ESLint, and ESM imports. We kept the new defaults.
  - We removed starter files we didn't need: a vendor README, an `AGENTS.md` with ads for a paid service, and a paid deploy tool.
- **`npm audit`:** 11 "high" findings, all in dev tools. The AI advised against `npm audit fix --force`, because it would downgrade Vitest.

## My review
_(I fill this in after going through the code with my mentor.)_
