/**
 * Everything the hold checks need to decide, loaded BEFORE the chain runs.
 * The checks only read it: no database calls inside a check, so each check is
 * a small pure function that is easy to test.
 *
 * It grows rule by rule (the seats asked for, the fan's current seats ...).
 */
export interface HoldContext {
  /** "Now" from the DATABASE clock, the one clock all API copies share. */
  now: Date;
  event: {
    /** When tickets go on sale (rule 2). */
    dropAt: Date;
  };
}
