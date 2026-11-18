// Rush: a quick live check of rule 6 against the RUNNING stack.
//
//   node scripts/rush.mjs          # 50 fans
//   node scripts/rush.mjs 200      # 200 fans
//
// 1. creates a small event that is already on sale (2 rows × 8 seats);
// 2. N fans click seat A1 at the same moment  → exactly 1 must win;
// 3. one fan sends 10 holds at the same moment → at most MAX_SEATS_PER_USER win.
// Needs Node 18+ (built-in fetch) and `docker compose up`. No packages.

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const FANS = Number(process.argv[2] ?? 50);
const MINUTE = 60_000;

async function call(method, path, { body, handle } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(handle ? { 'X-Username': handle } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** { "201": 1, "409 SEAT_TAKEN": 49 } */
function tally(results) {
  const counts = {};
  for (const r of results) {
    const key = r.status < 300 ? String(r.status) : `${r.status} ${r.body?.code}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

const event = await call('POST', '/events', {
  body: {
    name: `Rush test ${new Date().toLocaleTimeString()}`,
    venue: 'Rush script',
    startsAt: new Date(Date.now() + 7 * 24 * 60 * MINUTE).toISOString(),
    dropAt: new Date(Date.now() - MINUTE).toISOString(),
    rowCount: 2,
    seatsPerRow: 8,
    zones: [{ name: 'All', fromRow: 'A', toRow: 'B', priceAgorot: 10000 }],
  },
});
if (event.status !== 201) {
  console.error('Could not create the event. Is `docker compose up` running?', event);
  process.exit(1);
}
const eventId = event.body.id;

// --- 1. N fans, one seat, all at once -------------------------------------
const fans = await Promise.all(
  Array.from({ length: FANS }, (_, i) =>
    call('POST', '/session', { body: { name: `Rusher ${i}` } }).then((r) => r.body.handle),
  ),
);
const started = Date.now();
const race = await Promise.all(
  fans.map((handle) =>
    call('POST', `/events/${eventId}/holds`, { handle, body: { seats: ['A1'] } }),
  ),
);
const winners = race.filter((r) => r.status === 201).length;
console.log(`\n${FANS} fans clicked A1 at the same moment (${Date.now() - started} ms):`);
console.log(tally(race));

// --- 2. One fan, 10 holds at once ------------------------------------------
const greedy = (await call('POST', '/session', { body: { name: 'Greedy' } })).body.handle;
const flood = await Promise.all(
  Array.from({ length: 10 }, () =>
    call('POST', `/events/${eventId}/holds`, {
      handle: greedy,
      body: { bestAvailable: { count: 1 } },
    }),
  ),
);
const greedySeats = flood.filter((r) => r.status === 201).length;
console.log('\nOne fan sent 10 holds of 1 seat at the same moment:');
console.log(tally(flood));

// --- Verdict -----------------------------------------------------------------
const ok = winners === 1 && greedySeats <= 4;
console.log(
  `\n${ok ? 'PASS' : 'FAIL'}: ${winners} winner for A1 (want 1), ` +
    `${greedySeats} seats for one fan (want at most MAX_SEATS_PER_USER, default 4).`,
);
console.log(`See it: http://localhost:5173/events/${eventId}\n`);
process.exit(ok ? 0 : 1);
