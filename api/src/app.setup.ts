import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { validationExceptionFactory } from './common/validation/validation-exception.factory.js';

/**
 * Everything that turns a Nest app into "the SeatRush API".
 * main.ts and the E2E tests both call it, so the tests run exactly the app
 * that runs in production.
 */
export function configureApp(app: INestApplication): void {
  // Every route starts with /api (for example, /api/health). /docs does not.
  app.setGlobalPrefix('api');

  // Checks every request body against its DTO class.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // drop fields the DTO doesn't declare...
      forbidNonWhitelisted: true, // ...and reject the request if there are any
      transform: true, // give the controller a real DTO instance, typed
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // One error shape for every error.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Interactive docs at /docs, OpenAPI JSON at /docs-json.
  const config = new DocumentBuilder()
    .setTitle('SeatRush API')
    .setDescription(
      'A fair, fast ticket drop that never sells the same seat twice.',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}
