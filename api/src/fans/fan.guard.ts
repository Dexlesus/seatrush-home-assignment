import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '../common/errors/domain-error.js';
import { parseHandle } from './domain/handle.js';
import type { FanEntity } from './fan.entity.js';
import { FansService } from './fans.service.js';

/** A request after FanGuard let it in: it knows which fan sent it. */
export interface RequestWithFan extends Request {
  fan?: FanEntity;
}

/** The HTTP header that carries the fan's handle on every fan request. */
export const FAN_HEADER = 'x-username';

/**
 * Runs before every fan-only route (hold, release, checkout, my tickets).
 * Like an usher at the door: no ID card (no passwords), but your name must be
 * on the list. Lets the request in only if X-Username is a known handle.
 */
@Injectable()
export class FanGuard implements CanActivate {
  constructor(private readonly fans: FansService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithFan>();
    const header = request.headers[FAN_HEADER];
    const raw = Array.isArray(header) ? header[0] : header;

    if (!raw) {
      throw new DomainError(
        'IDENTITY_REQUIRED',
        'Please pick a username first (send it in the X-Username header).',
      );
    }

    const handle = parseHandle(raw);
    const fan = handle ? await this.fans.findByHandle(handle) : null;
    if (!fan) {
      throw new DomainError(
        'UNKNOWN_FAN',
        `We don't know the fan "${raw}". Please log in again.`,
        { handle: raw },
      );
    }

    request.fan = fan;
    return true;
  }
}
