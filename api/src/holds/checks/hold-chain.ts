import { chainOf, type HoldCheck } from './hold-check.js';
import { FanLimitCheck } from './fan-limit.check.js';
import { SaleOpenCheck } from './sale-open.check.js';
import { SeatCountCheck } from './seat-count.check.js';
import { SeatsAvailableCheck } from './seats-available.check.js';
import { SeatsExistCheck } from './seats-exist.check.js';

/**
 * The security line every hold request walks through, in order.
 * The first check that finds a problem stops the request.
 */
export function holdChain() {
  const checks: HoldCheck[] = [
    new SaleOpenCheck(), // rule 2: the drop time has passed
    new SeatCountCheck(), // rule 3: 1–4 seats, no duplicates
    new SeatsExistCheck(), // rules 1/3: the seats are in this hall
    new FanLimitCheck(), // rule 4: held + bought ≤ MAX_SEATS_PER_USER
    new SeatsAvailableCheck(), // rules 3/5/6: all free, or nothing is held
  ];
  const [first, ...rest] = checks;
  if (!first) {
    throw new Error('The hold chain needs at least one check');
  }
  return chainOf(first, ...rest);
}
