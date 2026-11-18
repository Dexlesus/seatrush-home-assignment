import { DomainError } from '../../common/errors/domain-error.js';

/**
 * Extra credit: promo codes at checkout, one per order.
 *
 * Strategy pattern: every code knows how to compute its own discount. The
 * checkout only asks "how much off?", so a new kind of code (e.g. "buy 3 pay
 * for 2") is one new class, and the checkout doesn't change.
 */
export interface PromoCode {
  readonly code: string;
  /** true = each fan can use it once, ever (WELCOME20). */
  readonly oncePerFan: boolean;
  /** The discount in agorot for this subtotal, already rounded. */
  discount(subtotalAgorot: number): number;
}

/** "X% off". Rounded to the nearest agora, half up: 10.5 → 11, 10.4 → 10. */
class PercentOff implements PromoCode {
  readonly oncePerFan = false;

  constructor(
    readonly code: string,
    private readonly percent: number,
  ) {}

  discount(subtotalAgorot: number): number {
    // Whole numbers only (no floating point): (subtotal × percent + 50) / 100,
    // rounded down, is the same as rounding subtotal × percent / 100 half up.
    return Math.floor((subtotalAgorot * this.percent + 50) / 100);
  }
}

/** "₪X off", once per fan ever. */
class FixedOffOnce implements PromoCode {
  readonly oncePerFan = true;

  constructor(
    readonly code: string,
    private readonly agorot: number,
  ) {}

  discount(): number {
    return this.agorot;
  }
}

const PROMO_CODES: ReadonlyMap<string, PromoCode> = new Map(
  [new PercentOff('SAVE10', 10), new FixedOffOnce('WELCOME20', 2000)].map(
    (promo) => [promo.code, promo],
  ),
);

/** " save10 " → the SAVE10 code. Unknown codes are refused (400). */
export function findPromoCode(input: string): PromoCode {
  const code = input.trim().toUpperCase();
  const promo = PROMO_CODES.get(code);
  if (!promo) {
    throw new DomainError(
      'PROMO_CODE_UNKNOWN',
      `"${code}" isn't a promo code we know. Check the spelling, or check out without it.`,
      { promoCode: code },
    );
  }
  return promo;
}

/**
 * The discount, then the total. The discount is never bigger than the
 * subtotal, so a total never goes below 0.
 */
export function applyPromo(
  subtotalAgorot: number,
  promo: PromoCode | null,
): { discountAgorot: number; totalAgorot: number } {
  const discountAgorot = promo
    ? Math.min(promo.discount(subtotalAgorot), subtotalAgorot)
    : 0;
  return { discountAgorot, totalAgorot: subtotalAgorot - discountAgorot };
}
