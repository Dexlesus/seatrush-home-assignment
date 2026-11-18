import { createHash } from 'node:crypto';
import { DomainError } from '../../common/errors/domain-error.js';
import type { SeatStatus } from '../../events/entities/seat.entity.js';

/** Pure rules about holds. No database here, so each one is unit tested. */

export type HoldStatus = 'ACTIVE' | 'RELEASED' | 'CONVERTED';

/** Rule 3: a hold lasts HOLD_TTL_SECONDS from the moment it is made. */
export function holdExpiresAt(now: Date, ttlSeconds: number): Date {
  return new Date(now.getTime() + ttlSeconds * 1000);
}

/**
 * Rule 5: is this seat free to hold right now?
 * A HELD seat whose hold has run out IS free, even if no cleanup job has run:
 * expiry is decided by comparing times, never by waiting for a job.
 */
export function isSeatFree(
  seat: { status: SeatStatus; heldUntil: Date | null },
  now: Date,
): boolean {
  if (seat.status === 'AVAILABLE') {
    return true;
  }
  if (seat.status === 'HELD') {
    return seat.heldUntil !== null && seat.heldUntil.getTime() <= now.getTime();
  }
  return false; // SOLD
}

/** "b2", " B1 " → "B2", "B1": how labels are compared everywhere. */
export function normalizeLabel(label: string): string {
  return label.trim().toUpperCase();
}

/** The canonical form of "hold these seats": normalized and sorted. */
export function normalizeSeatRequest(labels: string[]): { seats: string[] } {
  return { seats: labels.map(normalizeLabel).sort() };
}

/**
 * Idempotency-Key: a fingerprint of the request body.
 * Same meaning → same fingerprint, whatever the key order or seat order.
 * Stored next to the key, so "same key, different request" can be refused.
 */
export function requestFingerprint(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/** JSON with object keys sorted, so {x,y} and {y,x} give the same text. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Rule 3: only the fan who made a hold can release it early.
 * - another fan → 404 HOLD_NOT_FOUND (we don't even confirm it exists);
 * - already bought → 409 HOLD_ALREADY_PURCHASED;
 * - already released or expired → nothing to do (the seats may already be
 *   someone else's, so we must not touch them).
 */
export function decideRelease(
  hold: { fanId: string; status: HoldStatus; expiresAt: Date },
  fanId: string,
  now: Date,
): 'RELEASE' | 'ALREADY_OVER' {
  if (hold.fanId !== fanId) {
    throw new DomainError('HOLD_NOT_FOUND', "We couldn't find this hold.");
  }
  if (hold.status === 'CONVERTED') {
    throw new DomainError(
      'HOLD_ALREADY_PURCHASED',
      'These seats are already yours: this hold was checked out.',
    );
  }
  if (hold.status === 'RELEASED' || hold.expiresAt.getTime() <= now.getTime()) {
    return 'ALREADY_OVER';
  }
  return 'RELEASE';
}
