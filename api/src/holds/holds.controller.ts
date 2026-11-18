import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ErrorResponseDto } from '../common/errors/error-response.dto.js';
import { CurrentFan } from '../fans/current-fan.decorator.js';
import type { FanEntity } from '../fans/fan.entity.js';
import { FanGuard } from '../fans/fan.guard.js';
import {
  CreateHoldDto,
  HoldResponseDto,
  MyHoldsResponseDto,
} from './dto/hold.dto.js';
import { HoldsService } from './holds.service.js';

@ApiTags('holds')
@ApiSecurity('fan')
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'IDENTITY_REQUIRED or UNKNOWN_FAN',
})
@UseGuards(FanGuard)
@Controller()
export class HoldsController {
  constructor(private readonly holds: HoldsService) {}

  @Post('events/:eventId/holds')
  @ApiOperation({
    summary: 'Hold 1–4 seats for HOLD_TTL_SECONDS (all or nothing)',
    description:
      'Send `seats` (the seats clicked) or `bestAvailable` (N together, rule 7). Send an Idempotency-Key so a double click or a retry never makes two holds.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Any unique string per attempt (e.g. a UUID). Same key + same body → the same answer (200), no second hold.',
  })
  @ApiCreatedResponse({
    type: HoldResponseDto,
    description: 'The seats are held.',
  })
  @ApiOkResponse({
    type: HoldResponseDto,
    description: 'Replay of an earlier request with the same Idempotency-Key.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'VALIDATION_FAILED, INVALID_HOLD_REQUEST, INVALID_SEAT_COUNT, DUPLICATE_SEATS, SEAT_NOT_FOUND, INVALID_IDEMPOTENCY_KEY',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'SALE_NOT_OPEN',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'EVENT_NOT_FOUND',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'SEAT_TAKEN, FAN_LIMIT_REACHED, NO_SEATS_TOGETHER',
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: 'IDEMPOTENCY_KEY_REUSED',
  })
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateHoldDto,
    @CurrentFan() fan: FanEntity,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<HoldResponseDto> {
    const outcome = await this.holds.hold(fan, eventId, dto, idempotencyKey);
    res.status(outcome.status);
    if (outcome.replayed) {
      res.setHeader('Idempotent-Replayed', 'true');
    }
    return outcome.body;
  }

  @Delete('holds/:holdId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Release a hold early (only the fan who made it)',
    description:
      'Releasing a hold that already expired or was released does nothing (204).',
  })
  @ApiNoContentResponse({ description: 'Released (or already over).' })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'HOLD_NOT_FOUND',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'HOLD_ALREADY_PURCHASED',
  })
  release(
    @Param('holdId', ParseUUIDPipe) holdId: string,
    @CurrentFan() fan: FanEntity,
  ): Promise<void> {
    return this.holds.release(fan, holdId);
  }

  @Get('me/holds')
  @ApiOperation({
    summary: 'My active holds (to resume a hold after a reload)',
  })
  @ApiOkResponse({ type: MyHoldsResponseDto })
  myHolds(@CurrentFan() fan: FanEntity): Promise<MyHoldsResponseDto> {
    return this.holds.myHolds(fan);
  }
}
