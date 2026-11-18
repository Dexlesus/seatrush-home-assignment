import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FanEntity } from './fan.entity.js';
import type { RequestWithFan } from './fan.guard.js';

/**
 * `@CurrentFan() fan: FanEntity` in a controller method gives the fan that
 * FanGuard found. Use it only on routes protected by @UseGuards(FanGuard).
 */
export const CurrentFan = createParamDecorator(
  (_data: unknown, context: ExecutionContext): FanEntity => {
    const request = context.switchToHttp().getRequest<RequestWithFan>();
    if (!request.fan) {
      throw new Error('@CurrentFan() needs @UseGuards(FanGuard) on the route');
    }
    return request.fan;
  },
);
