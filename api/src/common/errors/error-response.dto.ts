import { ApiProperty } from '@nestjs/swagger';

/** The one shape of every error the API sends. Also shown in /docs. */
export class ErrorResponseDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({
    example: 'SEAT_TAKEN',
    description:
      'Stable code for programs. The web app turns it into a friendly message.',
  })
  code: string;

  @ApiProperty({ example: 'Someone just took B3.' })
  message: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { seats: ['B3'] },
    description: 'Extra facts about the error. Empty ({}) when there are none.',
  })
  details: Record<string, unknown>;

  @ApiProperty({ example: '/api/events/1/holds' })
  path: string;

  @ApiProperty({ example: '2026-11-18T10:00:00.000Z' })
  timestamp: string;
}
