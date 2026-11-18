import type { ExecutionContext } from '@nestjs/common';
import { DomainError } from '../common/errors/domain-error.js';
import { FanGuard, type RequestWithFan } from './fan.guard.js';
import type { FanEntity } from './fan.entity.js';
import type { FansService } from './fans.service.js';

const DANA: FanEntity = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: 'Dana',
  handle: 'dana#4821',
  createdAt: new Date(),
};

/** A fake request with the given headers, wrapped the way Nest passes it. */
function contextWith(headers: Record<string, string>) {
  const request = { headers } as unknown as RequestWithFan;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
}

/** A fake FansService that only knows Dana. */
function fansKnowingDana(): FansService {
  return {
    findByHandle: vi.fn(async (handle: string) =>
      handle === DANA.handle ? DANA : null,
    ),
  } as unknown as FansService;
}

describe('FanGuard: who is making this request?', () => {
  it('rejects a request without the X-Username header: IDENTITY_REQUIRED', async () => {
    const guard = new FanGuard(fansKnowingDana());
    const { context } = contextWith({});

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'IDENTITY_REQUIRED',
    });
  });

  it('rejects a handle nobody has: UNKNOWN_FAN', async () => {
    const guard = new FanGuard(fansKnowingDana());
    const { context } = contextWith({ 'x-username': 'ghost#0000' });

    const attempt = guard.canActivate(context);

    await expect(attempt).rejects.toBeInstanceOf(DomainError);
    await expect(attempt).rejects.toMatchObject({ code: 'UNKNOWN_FAN' });
  });

  it('lets a known fan in and remembers who they are on the request', async () => {
    const guard = new FanGuard(fansKnowingDana());
    const { context, request } = contextWith({ 'x-username': 'Dana#4821' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.fan).toEqual(DANA);
  });
});
