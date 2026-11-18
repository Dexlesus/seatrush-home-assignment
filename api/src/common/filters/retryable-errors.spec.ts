import type { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { ErrorResponseDto } from '../errors/error-response.dto.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function createHost() {
  const json = vi.fn<(body: ErrorResponseDto) => void>();
  const setHeader = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: '/api/events/1/holds' }),
      getResponse: () => ({ status, setHeader }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, setHeader, body: () => json.mock.calls[0]?.[0] };
}

describe('AllExceptionsFilter (rule 6): a deadlock is "please retry", not a crash', () => {
  it('answers 503 BUSY_TRY_AGAIN with Retry-After when PostgreSQL reports a deadlock', () => {
    const { host, status, setHeader, body } = createHost();
    const deadlock = new QueryFailedError(
      'UPDATE seats ...',
      [],
      Object.assign(new Error('deadlock detected'), { code: '40P01' }),
    );

    new AllExceptionsFilter().catch(deadlock, host);

    expect(status).toHaveBeenCalledWith(503);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '1');
    expect(body()?.code).toBe('BUSY_TRY_AGAIN');
    expect(body()?.message).not.toContain('deadlock');
  });
});
