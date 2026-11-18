import { Check, chainOf } from '../../common/chain/check.js';
import type { HoldContext } from './hold-context.js';

/**
 * One link of the chain of checks a hold request must pass (rules 2–6).
 * The mechanism is the generic Chain of Responsibility in common/chain.
 */
export abstract class HoldCheck extends Check<HoldContext> {}

export { chainOf };
