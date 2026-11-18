import { ApiProperty } from '@nestjs/swagger';

export class OrderSeatDto {
  @ApiProperty({ example: 'B1' })
  label: string;

  @ApiProperty({ example: 'Regular' })
  zone: string;

  @ApiProperty({ example: 15000 })
  priceAgorot: number;
}

export class OrderResponseDto {
  @ApiProperty({ example: '9b1d3f0e-2c4a-4e6b-8d0f-1a2b3c4d5e6f' })
  orderId: string;

  @ApiProperty({ example: '3d0c8a52-6b1e-4d6f-9a7e-2f1b0c9d8e7a' })
  holdId: string;

  @ApiProperty({ example: '7f3a2c9e-1b4d-4c8a-9e2f-0a1b2c3d4e5f' })
  eventId: string;

  @ApiProperty({ example: 'Coldplay' })
  eventName: string;

  @ApiProperty({ example: 'Bloomfield Stadium' })
  venue: string;

  @ApiProperty({ example: '2026-12-01T20:00:00.000Z' })
  startsAt: string;

  @ApiProperty({ type: [OrderSeatDto] })
  seats: OrderSeatDto[];

  @ApiProperty({
    example: 30000,
    description: 'Sum of the seat prices, in agorot.',
  })
  totalAgorot: number;

  @ApiProperty({ example: '2026-11-20T10:03:00.000Z' })
  createdAt: string;
}

export class MyOrdersResponseDto {
  @ApiProperty({ type: [OrderResponseDto], description: 'Newest first.' })
  orders: OrderResponseDto[];
}
