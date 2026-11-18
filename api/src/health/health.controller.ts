import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * "Is the API up?" Used by people, and later by Docker's healthcheck.
 * Stage 1 adds a database check.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check that the API is running' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
