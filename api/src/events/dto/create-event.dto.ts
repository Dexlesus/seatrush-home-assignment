import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsISO8601,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const ROW_LETTERS = /^[A-Za-z]{1,2}$/;

/** One price zone: a range of rows and the price of each seat in them. */
export class ZoneDto {
  @ApiProperty({ example: 'VIP' })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({
    example: 'A',
    description: 'First row of the zone. Row A is nearest the stage.',
  })
  @Matches(ROW_LETTERS, { message: 'fromRow must be a row letter, like A' })
  fromRow: string;

  @ApiProperty({ example: 'B', description: 'Last row of the zone.' })
  @Matches(ROW_LETTERS, { message: 'toRow must be a row letter, like B' })
  toRow: string;

  @ApiProperty({
    example: 30000,
    description: 'Price per seat in agorot (₪300 = 30000).',
  })
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  priceAgorot: number;
}

/** The body of POST /api/events. */
export class CreateEventDto {
  @ApiProperty({ example: 'Coldplay' })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiProperty({ example: 'Bloomfield Stadium' })
  @IsString()
  @Length(1, 200)
  venue: string;

  @ApiProperty({
    example: '2026-12-01T20:00:00.000Z',
    description: 'When the show starts.',
  })
  @IsISO8601()
  startsAt: string;

  @ApiProperty({
    example: '2026-11-20T10:00:00.000Z',
    description: 'When tickets go on sale. Must be before startsAt.',
  })
  @IsISO8601()
  dropAt: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  rowCount: number;

  @ApiProperty({ example: 4, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  seatsPerRow: number;

  @ApiProperty({
    type: [ZoneDto],
    description: 'Every row must be in exactly one zone.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((zone: ZoneDto) => zone.name, {
    message: 'each zone needs a different name',
  })
  @ValidateNested({ each: true })
  @Type(() => ZoneDto)
  zones: ZoneDto[];
}
