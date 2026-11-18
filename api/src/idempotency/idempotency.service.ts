import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { DomainError } from '../common/errors/domain-error.js';

/** Letters, digits and _ . : - ; up to 100 characters (UUIDs fit). */
const VALID_KEY = /^[A-Za-z0-9_.:-]{1,100}$/;

export interface Outcome<T> {
  status: number;
  body: T;
}

export interface IdempotentOutcome<T> extends Outcome<T> {
  /** True when this is a stored answer to an earlier, identical request. */
  replayed: boolean;
}

/**
 * Idempotency-Key, in the SAME transaction as the work it protects.
 *
 * 1. INSERT (fan, key, fingerprint) ... ON CONFLICT DO NOTHING.
 *    - A second request with the same key waits here (PRIMARY KEY) until the
 *      first one commits or rolls back.
 * 2. Nothing inserted → the key was used before:
 *    - same fingerprint → replay the stored answer (200), do nothing else;
 *    - different fingerprint → 422 IDEMPOTENCY_KEY_REUSED.
 * 3. Inserted → do the work, store its answer next to the key, COMMIT.
 *
 * If the work fails (e.g. SEAT_TAKEN), the whole transaction rolls back,
 * including the key: a failed request never "uses up" its key.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(options: {
    fanId: string;
    key: string | undefined;
    fingerprint: string;
    work: (manager: EntityManager) => Promise<Outcome<T>>;
  }): Promise<IdempotentOutcome<T>> {
    const { fanId, key, fingerprint, work } = options;
    if (key !== undefined && !VALID_KEY.test(key)) {
      throw new DomainError(
        'INVALID_IDEMPOTENCY_KEY',
        'Idempotency-Key must be 1–100 letters, digits or _ . : -',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      if (key !== undefined) {
        const claimed = await manager.query<{ key: string }[]>(
          `INSERT INTO idempotency_keys (fan_id, key, request_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (fan_id, key) DO NOTHING
           RETURNING key`,
          [fanId, key, fingerprint],
        );
        if (claimed.length === 0) {
          return this.replay<T>(manager, fanId, key, fingerprint);
        }
      }

      const outcome = await work(manager);

      if (key !== undefined) {
        await manager.query(
          `UPDATE idempotency_keys
              SET status_code = $3, response_body = $4
            WHERE fan_id = $1 AND key = $2`,
          [fanId, key, outcome.status, JSON.stringify(outcome.body)],
        );
      }
      return { ...outcome, replayed: false };
    });
  }

  private async replay<T>(
    manager: EntityManager,
    fanId: string,
    key: string,
    fingerprint: string,
  ): Promise<IdempotentOutcome<T>> {
    const rows = await manager.query<
      { requestHash: string; responseBody: T | null }[]
    >(
      `SELECT request_hash  AS "requestHash",
              response_body AS "responseBody"
         FROM idempotency_keys
        WHERE fan_id = $1 AND key = $2`,
      [fanId, key],
    );
    const stored = rows[0];
    if (!stored || stored.requestHash !== fingerprint) {
      throw new DomainError(
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used for a different request.',
      );
    }
    if (stored.responseBody === null) {
      // Can't happen: the answer is stored in the same transaction that
      // inserted the key, and we only see committed rows.
      throw new Error('Idempotency key has no stored response');
    }
    return { status: 200, body: stored.responseBody, replayed: true };
  }
}
