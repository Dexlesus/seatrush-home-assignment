import request from 'supertest';
import type { App } from 'supertest/types.js';

/**
 * Small helpers that speak to the API like the web app does, so each E2E test
 * reads like a story: "Dana logs in, holds B1 and B2, checks out".
 */

const MINUTE = 60 * 1000;

export interface ZoneBody {
  name: string;
  fromRow: string;
  toRow: string;
  priceAgorot: number;
}

export interface EventOptions {
  name?: string;
  /** Minutes until the drop; negative = already on sale (the default). */
  dropInMinutes?: number;
  rowCount?: number;
  seatsPerRow?: number;
  zones?: ZoneBody[];
}

/** POST /api/events → the new event's id. Default: 3 rows × 4 seats, on sale. */
export async function createEvent(
  server: App,
  options: EventOptions = {},
): Promise<string> {
  const rowCount = options.rowCount ?? 3;
  const lastRow = String.fromCharCode(64 + rowCount);
  const res = await request(server)
    .post('/api/events')
    .send({
      name: options.name ?? 'Test show',
      venue: 'Test hall',
      startsAt: new Date(Date.now() + 7 * 24 * 60 * MINUTE).toISOString(),
      dropAt: new Date(
        Date.now() + (options.dropInMinutes ?? -10) * MINUTE,
      ).toISOString(),
      rowCount,
      seatsPerRow: options.seatsPerRow ?? 4,
      zones: options.zones ?? [
        { name: 'All', fromRow: 'A', toRow: lastRow, priceAgorot: 10000 },
      ],
    })
    .expect(201);
  return res.body.id as string;
}

/** POST /api/session { name } → the new fan's handle, e.g. "dana#4821". */
export async function logIn(server: App, name = 'Fan'): Promise<string> {
  const res = await request(server)
    .post('/api/session')
    .send({ name })
    .expect(201);
  return res.body.handle as string;
}

/** Logs in `count` different fans at once. */
export function logInMany(server: App, count: number): Promise<string[]> {
  return Promise.all(
    Array.from({ length: count }, (_, i) => logIn(server, `Fan ${i}`)),
  );
}

export interface HoldBody {
  seats?: string[];
  bestAvailable?: { count: number; maxPriceAgorot?: number; zone?: string };
}

/** POST /api/events/:id/holds as `handle`. Returns the request to `.expect(...)`. */
export function hold(
  server: App,
  handle: string,
  eventId: string,
  body: HoldBody,
  idempotencyKey?: string,
) {
  const req = request(server)
    .post(`/api/events/${eventId}/holds`)
    .set('X-Username', handle)
    .send(body);
  return idempotencyKey ? req.set('Idempotency-Key', idempotencyKey) : req;
}

/** DELETE /api/holds/:id as `handle`. */
export function release(server: App, handle: string, holdId: string) {
  return request(server)
    .delete(`/api/holds/${holdId}`)
    .set('X-Username', handle);
}

/** POST /api/holds/:id/checkout as `handle`. */
export function checkout(server: App, handle: string, holdId: string) {
  return request(server)
    .post(`/api/holds/${holdId}/checkout`)
    .set('X-Username', handle);
}

/** The seat map as { "A1": "AVAILABLE", "B2": "HELD", ... }. */
export async function seatStatuses(
  server: App,
  eventId: string,
): Promise<Record<string, string>> {
  const res = await request(server)
    .get(`/api/events/${eventId}/seats`)
    .expect(200);
  const seats = res.body.seats as { label: string; status: string }[];
  return Object.fromEntries(seats.map((s) => [s.label, s.status]));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
