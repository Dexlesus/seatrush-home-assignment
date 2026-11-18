import { BestAvailableStrategy } from './best-available.strategy.js';
import { ExplicitSeatsStrategy } from './explicit-seats.strategy.js';
import { selectionStrategyFor } from './seat-selection.js';

describe('selectionStrategyFor (Strategy pattern): how the seats are chosen', () => {
  it('picks the explicit strategy when the fan clicked seats', () => {
    const strategy = selectionStrategyFor({ seats: ['B1', 'b2'] });

    expect(strategy).toBeInstanceOf(ExplicitSeatsStrategy);
  });

  it('picks the best-available strategy when the fan asked for "N together"', () => {
    const strategy = selectionStrategyFor({
      bestAvailable: { count: 2, maxPriceAgorot: 15000 },
    });

    expect(strategy).toBeInstanceOf(BestAvailableStrategy);
  });

  it('refuses a request that has both, or neither: INVALID_HOLD_REQUEST', () => {
    expect(() =>
      selectionStrategyFor({ seats: ['B1'], bestAvailable: { count: 1 } }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_HOLD_REQUEST' }));
    expect(() => selectionStrategyFor({})).toThrow(
      expect.objectContaining({ code: 'INVALID_HOLD_REQUEST' }),
    );
  });

  it('the explicit strategy describes its request in a normalized way', () => {
    const strategy = selectionStrategyFor({ seats: ['b2', 'B1'] });

    expect(strategy.describe()).toEqual({ seats: ['B1', 'B2'] });
  });
});
