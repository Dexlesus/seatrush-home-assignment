import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ErrorResponseDto } from '../common/errors/error-response.dto.js';
import { CurrentFan } from './current-fan.decorator.js';
import { FanResponseDto, LogInDto, toFanResponse } from './dto/session.dto.js';
import { FanGuard } from './fan.guard.js';
import type { FanEntity } from './fan.entity.js';
import { FansService } from './fans.service.js';

@ApiTags('fans')
@Controller()
export class SessionController {
  constructor(private readonly fans: FansService) {}

  @Post('session')
  @ApiOperation({
    summary: 'Log in without a password',
    description:
      'A name ("Dana") creates a NEW fan with a unique handle ("dana#4821"). A handle logs that fan back in.',
  })
  @ApiCreatedResponse({
    type: FanResponseDto,
    description: 'A new fan was created.',
  })
  @ApiOkResponse({
    type: FanResponseDto,
    description: 'An existing fan logged back in.',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'INVALID_NAME or VALIDATION_FAILED',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'FAN_NOT_FOUND' })
  async logIn(
    @Body() dto: LogInDto,
    // passthrough: we only set the status code; Nest still sends the body.
    @Res({ passthrough: true }) res: Response,
  ): Promise<FanResponseDto> {
    const { fan, created } = await this.fans.logIn(dto.name);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return toFanResponse(fan);
  }

  @Get('me')
  @UseGuards(FanGuard)
  @ApiSecurity('fan')
  @ApiOperation({ summary: 'Who am I? The fan of the X-Username header' })
  @ApiOkResponse({ type: FanResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'IDENTITY_REQUIRED or UNKNOWN_FAN',
  })
  me(@CurrentFan() fan: FanEntity): FanResponseDto {
    return toFanResponse(fan);
  }
}
