import { ValidationError } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory.js';
import { DomainError } from '../errors/domain-error.js';

/** Builds the same kind of object class-validator produces for one field. */
function fieldError(
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError {
  const error = new ValidationError();
  error.property = property;
  error.constraints = constraints;
  error.children = children;
  return error;
}

describe('validationExceptionFactory', () => {
  it('returns a DomainError with the code VALIDATION_FAILED', () => {
    const result = validationExceptionFactory([
      fieldError('name', { minLength: 'name is too short' }),
    ]);

    expect(result).toBeInstanceOf(DomainError);
    expect(result.code).toBe('VALIDATION_FAILED');
  });

  it('names the invalid fields in the message', () => {
    const result = validationExceptionFactory([
      fieldError('name', { minLength: 'name is too short' }),
      fieldError('seats', { arrayMaxSize: 'seats must have at most 4 items' }),
    ]);

    expect(result.message).toBe('Some fields are invalid: name, seats');
  });

  it('lists every problem of every field in details', () => {
    const result = validationExceptionFactory([
      fieldError('name', {
        minLength: 'name is too short',
        matches: 'name has invalid characters',
      }),
    ]);

    expect(result.details).toEqual({
      errors: [
        {
          field: 'name',
          problems: ['name is too short', 'name has invalid characters'],
        },
      ],
    });
  });

  it('gives nested fields a full path, like zones.0.priceAgorot', () => {
    const result = validationExceptionFactory([
      fieldError('zones', undefined, [
        fieldError('0', undefined, [
          fieldError('priceAgorot', { min: 'priceAgorot must not be less than 0' }),
        ]),
      ]),
    ]);

    expect(result.details).toEqual({
      errors: [
        {
          field: 'zones.0.priceAgorot',
          problems: ['priceAgorot must not be less than 0'],
        },
      ],
    });
  });

  it('reports fields that are not allowed at all', () => {
    const result = validationExceptionFactory([
      fieldError('isAdmin', { whitelistValidation: 'property isAdmin should not exist' }),
    ]);

    expect(result.details).toEqual({
      errors: [{ field: 'isAdmin', problems: ['property isAdmin should not exist'] }],
    });
  });
});
