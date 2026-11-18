import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import type { FanEntity } from '../fan.entity.js';

/** The body of POST /api/session. */
export class LogInDto {
  @ApiProperty({
    example: 'Dana',
    description:
      'Your name, to get a NEW handle (like "dana#4821"), or a handle you already have, to log back in.',
  })
  @IsString()
  @Length(1, 40)
  name: string;
}

export class FanResponseDto {
  @ApiProperty({
    example: 'dana#4821',
    description: 'Send it in the X-Username header on every fan request.',
  })
  handle: string;

  @ApiProperty({ example: 'Dana' })
  displayName: string;
}

export function toFanResponse(fan: FanEntity): FanResponseDto {
  return { handle: fan.handle, displayName: fan.displayName };
}
