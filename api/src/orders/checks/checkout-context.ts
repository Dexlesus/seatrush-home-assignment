import type { HoldStatus } from '../../holds/domain/hold-rules.js';

/** The hold being checked out, as locked in the database. */
export interface HoldToCheckOut {
  id: string;
  fanId: string;
  status: HoldStatus;
  expiresAt: Date;
}

/** Everything the checkout checks need, loaded before the chain runs. */
export interface CheckoutContext {
  /** "Now" from the database clock. */
  now: Date;
  /** The fan who is checking out. */
  fanId: string;
  /** null when no hold has this id. */
  hold: HoldToCheckOut | null;
}
