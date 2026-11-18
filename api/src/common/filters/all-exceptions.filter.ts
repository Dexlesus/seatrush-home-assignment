import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isRetryableConflict } from '../../database/postgres-errors.js';
import { DomainError } from '../errors/domain-error.js';
import { ERROR_STATUS } from '../errors/error-codes.js';
import type { ErrorResponseDto } from '../errors/error-response.dto.js';

type ErrorFacts = Pick<
  ErrorResponseDto,
  'statusCode' | 'code' | 'message' | 'details'
>;

/**
 * Catches every error thrown while handling a request (@Catch() with no
 * arguments means "all of them") and always answers in the same shape.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const facts = this.describe(exception);
    if (facts.code === 'BUSY_TRY_AGAIN') {
      // Tells clients (and the web app) when it's worth retrying.
      response.setHeader('Retry-After', '1');
    }
    const body: ErrorResponseDto = {
      ...facts,
      // originalUrl, not url: Express can cut the start of `url` along the
      // way (we saw "/nope" instead of "/api/nope"). originalUrl is always
      // the full path the client asked for.
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };

    response.status(facts.statusCode).json(body);
  }

  private describe(exception: unknown): ErrorFacts {
    // 1. Our own business errors: the status comes from the catalog.
    if (exception instanceof DomainError) {
      return {
        statusCode: ERROR_STATUS[exception.code],
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    // 2. Nest's built-in HTTP errors (unknown route, broken JSON, ...).
    //    HttpStatus[404] is 'NOT_FOUND', so the code comes from the status.
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        code: HttpStatus[statusCode] ?? 'HTTP_ERROR',
        message: messageOf(exception),
        details: {},
      };
    }

    // 3. PostgreSQL rolled back a transaction to stay consistent (deadlock or
    //    serialization failure). Nothing was saved: the client may retry.
    if (isRetryableConflict(exception)) {
      this.logger.warn('Database asked for a retry (deadlock/serialization)');
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'BUSY_TRY_AGAIN',
        message: 'Lots of fans are clicking right now. Please try again.',
        details: {},
      };
    }

    // 4. Anything else is a bug. Log the real error for us, and send the
    //    client a generic message: never SQL, stack traces or internal names.
    this.logger.error(
      'Unexpected error',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message:
        'Something went wrong on our side. Please try again in a moment.',
      details: {},
    };
  }
}

/** Nest stores the message either as a string or inside an object. */
function messageOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response &&
    typeof response.message === 'string'
  ) {
    return response.message;
  }
  return exception.message;
}
