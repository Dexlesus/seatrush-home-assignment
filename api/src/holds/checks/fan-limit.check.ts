import { DomainError } from '../../common/errors/domain-error.js';
import { HoldCheck } from './hold-check.js';
import type { HoldContext } from './hold-context.js';

/**
 * Rule 4: at most MAX_SEATS_PER_USER seats per fan per event, held and bought
 * seats together. `fanSeats.current` is counted after the fan's row is locked,
 * so many parallel requests from one fan are checked one after another.
 */
export class FanLimitCheck extends HoldCheck {
  protected validate({ requestedLabels, fanSeats }: HoldContext): void {
    const { current, limit } = fanSeats;
    if (current + requestedLabels.length <= limit) {
      return;
    }

    const remaining = Math.max(limit - current, 0);
    const message =
      remaining === 0
        ? `You already have ${current} seats for this show, the most one fan can have.`
        : `You can have up to ${limit} seats for this show. You have ${current}, so you can add ${remaining} more.`;
    throw new DomainError('FAN_LIMIT_REACHED', message, {
      limit,
      current,
      remaining,
    });
  }
}
