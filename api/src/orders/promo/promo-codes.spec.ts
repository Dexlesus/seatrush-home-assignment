import { applyPromo, findPromoCode } from './promo-codes.js';

describe('promo codes (extra credit): Strategy, one class per kind of discount', () => {
  it("SAVE10: the brief's example, ₪349.35 → discount ₪34.94, total ₪314.41", () => {
    expect(applyPromo(34935, findPromoCode('SAVE10'))).toEqual({
      discountAgorot: 3494,
      totalAgorot: 31441,
    });
  });

  it('SAVE10 rounds the discount to the nearest agora, half up, BEFORE subtracting', () => {
    expect(applyPromo(105, findPromoCode('SAVE10')).discountAgorot).toBe(11); // 10.5 → 11
    expect(applyPromo(104, findPromoCode('SAVE10')).discountAgorot).toBe(10); // 10.4 → 10
  });

  it('WELCOME20 takes ₪20 off', () => {
    expect(applyPromo(15000, findPromoCode('WELCOME20'))).toEqual({
      discountAgorot: 2000,
      totalAgorot: 13000,
    });
  });

  it('a total never goes below 0: ₪15 with WELCOME20 → ₪0', () => {
    expect(applyPromo(1500, findPromoCode('WELCOME20'))).toEqual({
      discountAgorot: 1500,
      totalAgorot: 0,
    });
  });

  it('no code → no discount', () => {
    expect(applyPromo(15000, null)).toEqual({
      discountAgorot: 0,
      totalAgorot: 15000,
    });
  });

  it('accepts any letter case and spaces, rejects unknown codes', () => {
    expect(findPromoCode(' save10 ').code).toBe('SAVE10');
    expect(() => findPromoCode('FREE100')).toThrow(
      expect.objectContaining({ code: 'PROMO_CODE_UNKNOWN' }),
    );
  });

  it('only WELCOME20 is once per fan ever', () => {
    expect(findPromoCode('WELCOME20').oncePerFan).toBe(true);
    expect(findPromoCode('SAVE10').oncePerFan).toBe(false);
  });
});
