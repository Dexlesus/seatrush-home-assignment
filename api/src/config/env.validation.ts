import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Every environment variable the API reads, with its type, its rules and its
 * default. The defaults match .env.example and docker-compose.yml, so the API
 * starts without a .env file.
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DB_HOST: string = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 55432;

  @IsString()
  @IsNotEmpty()
  DB_USER: string = 'seatrush';

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string = 'seatrush';

  @IsString()
  @IsNotEmpty()
  DB_NAME: string = 'seatrush';

  /** Rule 3: how long a hold lasts. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  HOLD_TTL_SECONDS: number = 300;

  /** Rule 4: the most seats one fan can have per event (held + bought). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_SEATS_PER_USER: number = 4;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  /** Create one demo event, already on sale, when the database has no events. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() === 'true' : value,
  )
  @IsBoolean()
  SEED_DEMO_EVENT: boolean = true;

  /** The web app's address, allowed to call the API from a browser (CORS). */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string = 'http://localhost:5173';
}

/**
 * Runs once, when the app starts. Bad config stops the app right away with a
 * clear message (fail fast), instead of failing later in the middle of a drop.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // 1. Copy the raw strings onto the class. @Type turns "300" into 300, and a
  //    missing variable keeps the default written above.
  const env = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });

  // 2. Check every rule. validateSync returns ALL problems, not just the first.
  const errors = validateSync(env);
  if (errors.length > 0) {
    const lines = errors.map(
      (error) =>
        `- ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }

  return env;
}
