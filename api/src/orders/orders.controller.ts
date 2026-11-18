import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ErrorResponseDto } from '../common/errors/error-response.dto.js';
import { CurrentFan } from '../fans/current-fan.decorator.js';
import type { FanEntity } from '../fans/fan.entity.js';
import { FanGuard } from '../fans/fan.guard.js';
import { MyOrdersResponseDto, OrderResponseDto } from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiSecurity('fan')
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'IDENTITY_REQUIRED or UNKNOWN_FAN',
})
@UseGuards(FanGuard)
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('holds/:holdId/checkout')
  @ApiOperation({
    summary: 'Check out a hold: the seats become sold and an order is created',
    description:
      'No real payment. Only the fan who holds the seats. One order per hold: checking out again returns the same order (200).',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiCreatedResponse({ type: OrderResponseDto, description: 'Order created.' })
  @ApiOkResponse({
    type: OrderResponseDto,
    description: 'This hold was already checked out: the same order.',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'NOT_YOUR_HOLD',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'HOLD_NOT_FOUND',
  })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'HOLD_RELEASED' })
  @ApiGoneResponse({ type: ErrorResponseDto, description: 'HOLD_EXPIRED' })
  async checkout(
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @CurrentFan() fan: FanEntity,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderResponseDto> {
    const outcome = await this.orders.checkout(fan, holdId, idempotencyKey);
    res.status(outcome.status);
    if (outcome.replayed) {
      res.setHeader('Idempotent-Replayed', 'true');
    }
    return outcome.body;
  }

  @Get('me/orders')
  @ApiOperation({ summary: 'My tickets: every order of the fan, newest first' })
  @ApiOkResponse({ type: MyOrdersResponseDto })
  myOrders(@CurrentFan() fan: FanEntity): Promise<MyOrdersResponseDto> {
    return this.orders.myOrders(fan);
  }
}
