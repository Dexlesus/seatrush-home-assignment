import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DomainError } from '../common/errors/domain-error.js';
import { isUniqueViolation } from '../database/postgres-errors.js';
import {
  createUniqueHandle,
  normalizeDisplayName,
  parseHandle,
} from './domain/handle.js';
import { FanEntity } from './fan.entity.js';

@Injectable()
export class FansService {
  constructor(
    @InjectRepository(FanEntity)
    private readonly fans: Repository<FanEntity>,
  ) {}

  findByHandle(handle: string): Promise<FanEntity | null> {
    return this.fans.findOneBy({ handle });
  }

  /**
   * "Log in" without a password:
   * - a handle ("dana#4821") → that existing fan, or 404 FAN_NOT_FOUND;
   * - a plain name ("Dana") → a NEW fan with a new unique handle.
   * Returns the fan and whether it was just created (201) or found (200).
   */
  async logIn(input: string): Promise<{ fan: FanEntity; created: boolean }> {
    if (input.includes('#')) {
      const handle = parseHandle(input);
      const fan = handle ? await this.findByHandle(handle) : null;
      if (!fan) {
        throw new DomainError(
          'FAN_NOT_FOUND',
          `There is no fan "${input.trim()}". Type just your name to get a new handle.`,
          { handle: input.trim() },
        );
      }
      return { fan, created: false };
    }

    const displayName = normalizeDisplayName(input);
    if (!displayName) {
      throw new DomainError(
        'INVALID_NAME',
        'A name needs 2–20 characters: letters, digits, spaces, "_" or "-".',
      );
    }

    let created: FanEntity | undefined;
    await createUniqueHandle(displayName, async (handle) => {
      try {
        created = await this.fans.save(
          this.fans.create({ displayName, handle }),
        );
        return true;
      } catch (error) {
        // Someone already has this handle: try another number.
        if (isUniqueViolation(error)) {
          return false;
        }
        throw error;
      }
    });
    if (!created) {
      throw new Error('createUniqueHandle returned without saving a fan');
    }
    return { fan: created, created: true };
  }
}
