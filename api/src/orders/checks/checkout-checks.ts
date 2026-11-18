import { Check, chainOf } from '../../common/chain/check.js';
import { DomainError } from '../../common/errors/domain-error.js';
import type { CheckoutContext } from './checkout-context.js';

/**
 * The checkout chain (Chain of Responsibility, rules 5 and 8).
 * A hold that was already bought (CONVERTED) passes every link, so checking
 * out again returns the same order instead of an error.
 */
abstract class CheckoutCheck extends Check<CheckoutContext> {}

class HoldExistsCheck extends CheckoutCheck {
  protected validate({ hold }: CheckoutContext): void {
    if (!hold) {
      throw new DomainError('HOLD_NOT_FOUND', "We couldn't find this hold.");
    }
  }
}

/** Rule 8: only the fan who holds the seats can check out. */
class HoldOwnerCheck extends CheckoutCheck {
  protected validate({ hold, fanId }: CheckoutContext): void {
    if (hold && hold.fanId !== fanId) {
      throw new DomainError(
        'NOT_YOUR_HOLD',
        'This hold belongs to another fan.',
      );
    }
  }
}

class HoldNotReleasedCheck extends CheckoutCheck {
  protected validate({ hold }: CheckoutContext): void {
    if (hold?.status === 'RELEASED') {
      throw new DomainError(
        'HOLD_RELEASED',
        "You released these seats. Hold them again if they're still free.",
      );
    }
  }
}

/** Rule 5: from the moment a hold expires, checkout fails. No cleanup needed. */
class HoldNotExpiredCheck extends CheckoutCheck {
  protected validate({ hold, now }: CheckoutContext): void {
    if (
      hold?.status === 'ACTIVE' &&
      hold.expiresAt.getTime() <= now.getTime()
    ) {
      throw new DomainError(
        'HOLD_EXPIRED',
        'Your hold ran out and the seats went back on sale. Try again; they might still be free.',
        { expiredAt: hold.expiresAt.toISOString() },
      );
    }
  }
}

export function checkoutChain(): Check<CheckoutContext> {
  return chainOf<CheckoutContext>(
    new HoldExistsCheck(),
    new HoldOwnerCheck(),
    new HoldNotReleasedCheck(),
    new HoldNotExpiredCheck(),
  );
}
