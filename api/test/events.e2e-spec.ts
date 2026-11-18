import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

/** A valid event: 3 rows (A–C) × 4 seats. VIP is row A, Regular is rows B–C. */
function validEvent() {
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const inOneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    name: 'Coldplay',
    venue: 'Bloomfield Stadium',
    startsAt: inOneWeek.toISOString(),
    dropAt: inOneHour.toISOString(),
    rowCount: 3,
    seatsPerRow: 4,
    zones: [
      { name: 'VIP', fromRow: 'A', toRow: 'A', priceAgorot: 30000 },
      { name: 'Regular', fromRow: 'B', toRow: 'C', priceAgorot: 15000 },
    ],
  };
}

describe('Rule 1: seat map (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  /** How many events are saved in the database right now. */
  async function countEvents(): Promise<number> {
    const rows = await t.db.query<{ count: string }[]>(
      'select count(*) from events',
    );
    return Number(rows[0]?.count);
  }

  it('creates an event and answers 201 with its id and zones', async () => {
    const res = await request(t.app.getHttpServer())
      .post('/api/events')
      .send(validEvent())
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Coldplay',
      venue: 'Bloomfield Stadium',
      rowCount: 3,
      seatsPerRow: 4,
      zones: [
        { name: 'VIP', fromRow: 'A', toRow: 'A', priceAgorot: 30000 },
        { name: 'Regular', fromRow: 'B', toRow: 'C', priceAgorot: 15000 },
      ],
    });
    expect(res.body).toHaveProperty('id');
  });

  it('shows the seat map: 12 available seats, A1 to C4, priced by zone', async () => {
    const created = await request(t.app.getHttpServer())
      .post('/api/events')
      .send(validEvent())
      .expect(201);
    const eventId: string = created.body.id;

    const res = await request(t.app.getHttpServer())
      .get(`/api/events/${eventId}/seats`)
      .expect(200);

    const seats: { label: string; status: string }[] = res.body.seats;
    expect(seats).toHaveLength(12);
    expect(seats.map((s) => s.label)).toEqual([
      'A1',
      'A2',
      'A3',
      'A4',
      'B1',
      'B2',
      'B3',
      'B4',
      'C1',
      'C2',
      'C3',
      'C4',
    ]);
    expect(seats.every((s) => s.status === 'AVAILABLE')).toBe(true);
    expect(seats[0]).toMatchObject({
      label: 'A1',
      row: 'A',
      seatNumber: 1,
      zone: 'VIP',
      priceAgorot: 30000,
    });
    expect(seats[11]).toMatchObject({
      label: 'C4',
      row: 'C',
      seatNumber: 4,
      zone: 'Regular',
      priceAgorot: 15000,
    });
  });

  it('rejects overlapping zones with 400 ZONES_OVERLAP and saves nothing', async () => {
    const before = await countEvents();
    const event = validEvent();
    event.zones[0] = {
      name: 'VIP',
      fromRow: 'A',
      toRow: 'B',
      priceAgorot: 30000,
    }; // B is also Regular

    const res = await request(t.app.getHttpServer())
      .post('/api/events')
      .send(event)
      .expect(400);

    expect(res.body.code).toBe('ZONES_OVERLAP');
    expect(res.body.message).toContain('B');
    expect(await countEvents()).toBe(before);
  });

  it('rejects invalid fields with 400 VALIDATION_FAILED, naming each field', async () => {
    const event = {
      ...validEvent(),
      rowCount: -1,
      zones: [{ name: 'VIP', fromRow: 'A', toRow: 'A' }], // no price
    };

    const res = await request(t.app.getHttpServer())
      .post('/api/events')
      .send(event)
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_FAILED');
    const fields = (res.body.details.errors as { field: string }[]).map(
      (e) => e.field,
    );
    expect(fields).toEqual(
      expect.arrayContaining(['rowCount', 'zones.0.priceAgorot']),
    );
  });

  it('answers 404 EVENT_NOT_FOUND for an event that does not exist', async () => {
    const missingId = '00000000-0000-4000-8000-000000000000';

    const event = await request(t.app.getHttpServer())
      .get(`/api/events/${missingId}`)
      .expect(404);
    const seats = await request(t.app.getHttpServer())
      .get(`/api/events/${missingId}/seats`)
      .expect(404);

    expect(event.body.code).toBe('EVENT_NOT_FOUND');
    expect(seats.body.code).toBe('EVENT_NOT_FOUND');
  });
});
