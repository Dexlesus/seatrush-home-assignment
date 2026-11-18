import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BestAvailableDto {
  @ApiProperty({
    example: 2,
    minimum: 1,
    maximum: 4,
    description: 'How many seats side by side.',
  })
  @IsInt()
  @Min(1)
  @Max(4)
  count: number;

  @ApiPropertyOptional({
    example: 20000,
    description: 'Max price per seat, in agorot.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPriceAgorot?: number;

  @ApiPropertyOptional({
    example: 'Regular',
    description: 'Only seats in this zone.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  zone?: string;
}

/**
 * The body of POST /api/events/:eventId/holds. Send exactly ONE of:
 * - `seats`: the seats the fan clicked, e.g. ["B1", "B2"];
 * - `bestAvailable`: "N seats together", chosen by the server (rule 7).
 */
export class CreateHoldDto {
  @ApiPropertyOptional({
    example: ['B1', 'B2'],
    description: '1 to 4 seat labels. All are held, or none.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 10, { each: true })
  seats?: string[];

  @ApiPropertyOptional({ type: BestAvailableDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BestAvailableDto)
  bestAvailable?: BestAvailableDto;
}

export class HeldSeatDto {
  @ApiProperty({ example: 'B1' })
  label: string;

  @ApiProperty({ example: 'Regular' })
  zone: string;

  @ApiProperty({ example: 15000 })
  priceAgorot: number;
}

export class HoldResponseDto {
  @ApiProperty({ example: '3d0c8a52-6b1e-4d6f-9a7e-2f1b0c9d8e7a' })
  holdId: string;

  @ApiProperty({ example: '7f3a2c9e-1b4d-4c8a-9e2f-0a1b2c3d4e5f' })
  eventId: string;

  @ApiProperty({ enum: ['ACTIVE', 'RELEASED', 'CONVERTED'], example: 'ACTIVE' })
  status: string;

  @ApiProperty({ type: [HeldSeatDto] })
  seats: HeldSeatDto[];

  @ApiProperty({ example: 30000 })
  totalAgorot: number;

  @ApiProperty({
    example: '2026-11-20T10:05:00.000Z',
    description:
      'From this moment checkout fails and the seats are back on sale.',
  })
  expiresAt: string;

  @ApiProperty({
    example: '2026-11-20T10:00:00.000Z',
    description: 'The server clock, for the countdown.',
  })
  serverNow: string;
}

export class MyHoldsResponseDto {
  @ApiProperty({ example: '2026-11-20T10:01:00.000Z' })
  serverNow: string;

  @ApiProperty({
    type: [HoldResponseDto],
    description: 'Active holds that have not expired.',
  })
  holds: HoldResponseDto[];
}
