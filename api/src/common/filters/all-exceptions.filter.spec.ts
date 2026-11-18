import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { DomainError } from '../errors/domain-error.js';
import type { ErrorResponseDto } from '../errors/error-response.dto.js';

/**
 * A fake "host": just enough of Nest's request/response objects for the
 * filter to read the URL and send a status + JSON body. No real server.
 */
function createHost(url: string) {
  const json = vi.fn<(body: ErrorResponseDto) => void>();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, sentBody: () => json.mock.calls[0]?.[0] };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('sends a DomainError with its code, message, details and the status from the catalog', () => {
    const { host, status, sentBody } = createHost('/api/session');
    const error = new DomainError('VALIDATION_FAILED', 'Some fields are invalid: name', {
      errors: [{ field: 'name', problems: ['name is too short'] }],
    });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(sentBody()).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Some fields are invalid: name',
      details: { errors: [{ field: 'name', problems: ['name is too short'] }] },
      path: '/api/session',
    });
  });

  it("turns Nest's own HTTP errors into the same shape, with a code made from the status", () => {
    const { host, status, sentBody } = createHost('/api/nope');

    filter.catch(new NotFoundException('Cannot GET /api/nope'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(sentBody()).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /api/nope',
      details: {},
    });
  });

  it('keeps the message of a plain 400 error (for example, broken JSON)', () => {
    const { host, sentBody } = createHost('/api/session');

    filter.catch(new BadRequestException('Unexpected token } in JSON'), host);

    expect(sentBody()).toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Unexpected token } in JSON',
    });
  });

  it('hides the details of an unexpected crash from the client, but logs them', () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host, status, sentBody } = createHost('/api/session');

    filter.catch(new Error('relation "users" does not exist'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(sentBody()?.code).toBe('INTERNAL_ERROR');
    expect(sentBody()?.message).not.toContain('relation');
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });

  it('adds the request path and an ISO timestamp to every error', () => {
    const { host, sentBody } = createHost('/api/events/42');

    filter.catch(new NotFoundException(), host);

    const body = sentBody();
    expect(body?.path).toBe('/api/events/42');
    expect(Number.isNaN(Date.parse(body?.timestamp ?? ''))).toBe(false);
  });
});
