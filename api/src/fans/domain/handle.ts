/**
 * Fan identity without passwords. A fan types a name ("Dana") and gets a
 * unique handle ("dana#4821"). Two people named Dana get two different handles,
 * so they are two different fans. Pure functions: no database here.
 */

/** Letters in any language, digits, space, "_" and "-". No < > " etc. */
const ALLOWED_NAME = /^[\p{L}\p{N} _-]+$/u;
const MIN_NAME = 2;
const MAX_NAME = 20;

/** "  Dana    Cohen " → "Dana Cohen". Not a valid name → null. */
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < MIN_NAME || name.length > MAX_NAME) {
    return null;
  }
  return ALLOWED_NAME.test(name) ? name : null;
}

/** A handle: a lowercase name, "#", then 4 or 6 digits. */
const HANDLE = /^[\p{L}\p{N}_-]+#(\d{4}|\d{6})$/u;

/** "  Dana#4821 " → "dana#4821". Not a handle → null. */
export function parseHandle(raw: string): string | null {
  const handle = raw.trim().toLowerCase();
  return HANDLE.test(handle) ? handle : null;
}

/** First tries with 4 digits (10,000 tags per name), then with 6 (1,000,000). */
const SHORT_TAG_TRIES = 5;
const LONG_TAG_TRIES = 20;

/**
 * Finds a free handle for this name.
 *
 * `tryHandle` tries to save the handle and answers true if it worked, or
 * false if someone already has it. The database's UNIQUE constraint is the
 * real referee: even two requests at the same moment can't get the same handle.
 *
 * `random` is a parameter so tests can pass a fixed "dice" (Math.random by default).
 */
export async function createUniqueHandle(
  displayName: string,
  tryHandle: (handle: string) => Promise<boolean>,
  random: () => number = Math.random,
): Promise<string> {
  const base = displayName.toLowerCase().replace(/ /g, '_');

  for (let attempt = 0; attempt < SHORT_TAG_TRIES + LONG_TAG_TRIES; attempt++) {
    const digits = attempt < SHORT_TAG_TRIES ? 4 : 6;
    const handle = `${base}#${randomTag(digits, random)}`;
    if (await tryHandle(handle)) {
      return handle;
    }
  }
  throw new Error(`No free handle found for "${displayName}"`);
}

/** randomTag(4, () => 0.0042) → "0042": always exactly `digits` digits. */
function randomTag(digits: number, random: () => number): string {
  return String(Math.floor(random() * 10 ** digits)).padStart(digits, '0');
}
