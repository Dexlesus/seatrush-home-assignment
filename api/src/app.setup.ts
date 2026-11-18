import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { EnvironmentVariables } from './config/env.validation.js';
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

  // Only the web app may call the API from a browser on another origin.
  // (In Docker the web app proxies /api, so this matters only in development.)
  const env = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  app.enableCors({
    origin: env.get('CORS_ORIGIN', { infer: true }),
    exposedHeaders: ['Retry-After', 'Idempotent-Replayed'],
  });

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
    // Fan-only routes need the fan's handle in this header. In /docs, click
    // "Authorize" and paste a handle from POST /api/session.
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Username' }, 'fan')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    // Remember the chosen fan in the browser, so a page reload keeps it.
    swaggerOptions: { persistAuthorization: true },
    customJsStr: RESET_FORMS_ON_FAN_SWITCH,
  });
}

/**
 * Swagger UI keeps every filled-in form when you switch fan (Authorize /
 * Logout), which makes it easy to send a request as the wrong fan by mistake.
 * This reloads /docs right after a switch: the forms start empty, and
 * persistAuthorization keeps the new fan. Plain browser JavaScript, run only
 * on the /docs page.
 */
const RESET_FORMS_ON_FAN_SWITCH = `
// seatrush-docs-reset
document.addEventListener('click', function (event) {
  var target = event.target;
  var button = target instanceof Element ? target.closest('.modal-ux button') : null;
  if (!button) return;
  var label = (button.textContent || '').trim();
  if (label === 'Authorize' || label === 'Logout') {
    // Let Swagger save the new fan first, then start from clean forms.
    setTimeout(function () { window.location.reload(); }, 300);
  }
});
`;
