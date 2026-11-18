import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';

/**
 * "Is the API up, and can it reach the database?"
 * Docker's healthcheck calls it, so the web app starts only once the API works.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Check that the API and its database are up' })
  @ApiOkResponse({ schema: { example: { status: 'ok', database: 'up' } } })
  @ApiServiceUnavailableResponse({
    description: 'The database is not reachable.',
  })
  async check(): Promise<{ status: 'ok'; database: 'up' }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('The database is not reachable.');
    }
    return { status: 'ok', database: 'up' };
  }
}
