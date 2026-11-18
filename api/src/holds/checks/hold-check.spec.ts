import { chainOf, HoldCheck } from './hold-check.js';
import type { HoldContext } from './hold-context.js';

/** A test checker: writes its name in a log, and fails if told to. */
class RecordingCheck extends HoldCheck {
  constructor(
    private readonly name: string,
    private readonly log: string[],
    private readonly fails = false,
  ) {
    super();
  }

  protected validate(): void {
    this.log.push(this.name);
    if (this.fails) {
      throw new Error(`${this.name} stopped the request`);
    }
  }
}

const anyContext: HoldContext = {
  now: new Date(),
  event: { dropAt: new Date() },
};

describe('the chain of checks (Chain of Responsibility)', () => {
  it('runs every check, in order, when they all pass', () => {
    const log: string[] = [];
    const chain = chainOf(
      new RecordingCheck('A', log),
      new RecordingCheck('B', log),
      new RecordingCheck('C', log),
    );

    chain.check(anyContext);

    expect(log).toEqual(['A', 'B', 'C']);
  });

  it('stops at the first check that fails: the checks after it never run', () => {
    const log: string[] = [];
    const chain = chainOf(
      new RecordingCheck('A', log),
      new RecordingCheck('B', log, true), // B fails
      new RecordingCheck('C', log),
    );

    expect(() => chain.check(anyContext)).toThrow('B stopped the request');
    expect(log).toEqual(['A', 'B']); // C never ran
  });
});
