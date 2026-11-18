import {
  createUniqueHandle,
  normalizeDisplayName,
  parseHandle,
} from './handle.js';

describe('normalizeDisplayName: the name a fan types', () => {
  it('trims spaces around the name and between words', () => {
    expect(normalizeDisplayName('  Dana  ')).toBe('Dana');
    expect(normalizeDisplayName('Dana    Cohen')).toBe('Dana Cohen');
  });

  it('rejects names that are too short or too long', () => {
    expect(normalizeDisplayName('D')).toBeNull(); // under 2 characters
    expect(normalizeDisplayName('a'.repeat(21))).toBeNull(); // over 20
  });

  it('allows letters in any language, but not symbols like < >', () => {
    expect(normalizeDisplayName('דנה')).toBe('דנה');
    expect(normalizeDisplayName('Dana<script>')).toBeNull();
  });
});

describe('createUniqueHandle: name → "dana#4821"', () => {
  /** A fake "is it free?" check: answers from a list, one answer per try. */
  function answers(...free: boolean[]) {
    return vi.fn(async (_handle: string) => free.shift() ?? true);
  }

  it('makes a lowercase handle with a 4-digit tag', async () => {
    const tryHandle = answers(true);

    const handle = await createUniqueHandle('Dana', tryHandle, () => 0.4821);

    expect(handle).toBe('dana#4821');
  });

  it('pads small numbers with zeros, so the tag always has 4 digits', async () => {
    const handle = await createUniqueHandle(
      'Dana',
      answers(true),
      () => 0.0042,
    );

    expect(handle).toBe('dana#0042');
  });

  it('tries another number when the handle is taken', async () => {
    const tryHandle = answers(false, false, true); // taken, taken, free

    const handle = await createUniqueHandle('Dana', tryHandle, Math.random);

    expect(tryHandle).toHaveBeenCalledTimes(3);
    expect(handle).toMatch(/^dana#\d{4}$/);
  });

  it('switches to 6 digits after 5 taken 4-digit handles', async () => {
    const tryHandle = answers(false, false, false, false, false, true);

    const handle = await createUniqueHandle('Dana', tryHandle, Math.random);

    expect(tryHandle).toHaveBeenCalledTimes(6);
    expect(handle).toMatch(/^dana#\d{6}$/);
  });

  it('joins the words of a name with "_": "Dana Cohen" → "dana_cohen#..."', async () => {
    const handle = await createUniqueHandle(
      'Dana Cohen',
      answers(true),
      () => 0.1,
    );

    expect(handle).toBe('dana_cohen#1000');
  });
});

describe('parseHandle: is this a valid handle?', () => {
  it('accepts a name, "#" and 4 or 6 digits', () => {
    expect(parseHandle('dana#4821')).toBe('dana#4821');
    expect(parseHandle('dana#482193')).toBe('dana#482193');
  });

  it('ignores case and spaces around it', () => {
    expect(parseHandle('  Dana#4821 ')).toBe('dana#4821');
  });

  it('rejects text that is not a handle', () => {
    expect(parseHandle('dana')).toBeNull(); // no tag
    expect(parseHandle('dana#12')).toBeNull(); // too few digits
    expect(parseHandle('#4821')).toBeNull(); // no name
  });
});
