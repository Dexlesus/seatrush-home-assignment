import {
  defaultDraft,
  rowLetter,
  shekelsToAgorot,
  toCreateEventBody,
  toDateTimeLocal,
} from './eventForm';

describe('the admin "create event" form', () => {
  it('names rows like the API: A…Z, then AA', () => {
    expect([rowLetter(0), rowLetter(25), rowLetter(26), rowLetter(27)]).toEqual([
      'A',
      'Z',
      'AA',
      'AB',
    ]);
  });

  it('turns shekels typed by a person into whole agorot', () => {
    expect(shekelsToAgorot('150')).toBe(15000);
    expect(shekelsToAgorot('349.35')).toBe(34935);
    expect(shekelsToAgorot(' 0.1 ')).toBe(10);
    expect(shekelsToAgorot('abc')).toBeNull();
    expect(shekelsToAgorot('-5')).toBeNull();
    expect(shekelsToAgorot('1.234')).toBeNull(); // no fractions of an agora
  });

  it('the default draft is valid and drops in 2 minutes, so the countdown can be watched', () => {
    const now = new Date(2026, 10, 20, 10, 0);
    const draft = defaultDraft(now);
    const { body, errors } = toCreateEventBody({ ...draft, name: 'Coldplay', venue: 'Park' });

    expect(errors).toEqual([]);
    expect(draft.dropAt).toBe(toDateTimeLocal(new Date(2026, 10, 20, 10, 2)));
    expect(body).toMatchObject({
      name: 'Coldplay',
      rowCount: 5,
      seatsPerRow: 8,
      zones: [
        { name: 'VIP', fromRow: 'A', toRow: 'A', priceAgorot: 30000 },
        { name: 'Regular', fromRow: 'B', toRow: 'E', priceAgorot: 15000 },
      ],
    });
    expect(body?.dropAt).toBe(new Date(2026, 10, 20, 10, 2).toISOString());
  });

  it('lists every problem before sending anything', () => {
    const draft = defaultDraft(new Date(2026, 10, 20, 10, 0));
    const { body, errors } = toCreateEventBody({
      ...draft,
      name: ' ',
      venue: 'Park',
      rowCount: '0',
      dropAt: draft.startsAt, // the drop must be BEFORE the show
      zones: [{ name: 'All', fromRow: 'a', toRow: 'e', price: 'free' }],
    });

    expect(body).toBeUndefined();
    expect(errors).toEqual([
      'Give the event a name.',
      'Rows must be a whole number from 1 to 100.',
      'Tickets must go on sale before the show starts.',
      'Zone "All": the price must be in shekels, like 150 or 149.90.',
    ]);
  });
});
