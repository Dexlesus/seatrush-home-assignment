import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/errors/error-response.dto.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import {
  EventResponseDto,
  SeatMapResponseDto,
} from './dto/event-response.dto.js';
import { EventsService } from './events.service.js';

/**
 * The HTTP side of events. Thin on purpose: it reads the request, calls the
 * service, and returns the answer. The rules live in the service.
 */
@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an event (admin, no login)',
    description:
      'Creates the event, its price zones and all its seats. Every row must be in exactly one zone.',
  })
  @ApiCreatedResponse({ type: EventResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'VALIDATION_FAILED, INVALID_EVENT_TIMES, ZONES_GAP, ZONES_OVERLAP, ZONE_ROW_OUT_OF_RANGE or ZONE_ROWS_REVERSED',
  })
  create(@Body() dto: CreateEventDto): Promise<EventResponseDto> {
    return this.events.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event and its zones' })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'EVENT_NOT_FOUND',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EventResponseDto> {
    return this.events.findOne(id);
  }

  @Get(':id/seats')
  @ApiOperation({
    summary: 'Get the seat map: every seat with its zone, price and status',
  })
  @ApiOkResponse({ type: SeatMapResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'EVENT_NOT_FOUND',
  })
  seatMap(@Param('id', ParseUUIDPipe) id: string): Promise<SeatMapResponseDto> {
    return this.events.seatMap(id);
  }
}
