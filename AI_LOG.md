# AI_LOG

**Tool:** Claude Code (model: Claude Opus 5.5), inside VS Code.

**How I work with it.** In every stage:
1. The AI explains the plan, and I approve it or change it.
2. The AI writes the code.
3. The AI walks me through every file and asks me review questions.
4. I move on only when I can explain the code myself.

## Real examples

### Planning
- **Fan identity: changed after my question.** The AI first suggested a plain username in a header. I asked what happens when two different people both type "Dana". We changed it to a unique handle, `dana#4821`.
- **Releasing handles: my idea, rejected.** I suggested freeing a handle's number when a fan leaves or buys, so it could be reused.
  - The AI pointed out that a reused handle would show the old fan's tickets to the new fan.
  - It also pointed out that the server can't tell when someone "left".
  - Handles stay permanent.
- **Locking: I chose from options.** The AI showed three ways to prevent double-selling: row locks, one conditional UPDATE, and SERIALIZABLE + retry. I picked row locks (`FOR UPDATE`) as the simplest to explain and verify.
- **Fan experience: my additions.**
  - I asked for a per-minute reminder while a hold runs. The AI suggested a banner that updates in place, not a popup every minute, turning orange at 1:00 and red at 0:30.
  - I asked that the screen show up front how many seats together are available, instead of letting a fan click and fail.

### Stage 0a: project skeleton
- The AI generated the NestJS project with the official CLI.
- It wrote `docker-compose.yml`, `.env.example`, `.gitignore` and `.gitattributes`.
- The AI removed starter files we don't need (the vendor README, AGENTS.md, a paid deploy tool) and turned `no-explicit-any` on.
- The AI checked `npm audit`: 0 issues in production code. It advised against `npm audit fix --force`, which would downgrade Vitest.
- My review: _(I fill this in after the walkthrough)_
