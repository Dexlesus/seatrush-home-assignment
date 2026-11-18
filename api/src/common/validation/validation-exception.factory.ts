import type { ValidationError } from 'class-validator';
import { DomainError } from '../errors/domain-error.js';

interface FieldProblems {
  field: string;
  problems: string[];
}

/**
 * The ValidationPipe calls this when a request body is invalid.
 * We turn class-validator's tree of errors into a flat, readable DomainError:
 *
 *   message: "Some fields are invalid: name, zones.0.priceAgorot"
 *   details: { errors: [{ field: "zones.0.priceAgorot", problems: [...] }] }
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): DomainError {
  const fields = flatten(errors);
  return new DomainError(
    'VALIDATION_FAILED',
    `Some fields are invalid: ${fields.map((f) => f.field).join(', ')}`,
    { errors: fields },
  );
}

/**
 * class-validator nests errors for objects and arrays:
 * zones -> 0 -> priceAgorot. We walk down the tree and join the names with dots.
 */
function flatten(errors: ValidationError[], parentPath = ''): FieldProblems[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = error.constraints
      ? [{ field, problems: Object.values(error.constraints) }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}
