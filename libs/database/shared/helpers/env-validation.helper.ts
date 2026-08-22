import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';

import { EnvironmentVariables } from '../config/env.validation';

/** Formats class-validator errors into a single actionable message. */
function formatErrors(errors: ValidationError[]): string {
  return errors
    .map((error) => {
      const constraints = error.constraints ? Object.values(error.constraints) : [];
      return `- ${error.property}: ${constraints.join(', ') || 'validation failed'}`;
    })
    .join('\n');
}

/**
 * Nest `ConfigModule` validate function for the shared environment.
 * Coerces and validates the required variables; throws with a meaningful
 * error listing every invalid or missing variable when validation fails.
 */
export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration. Fix the following variables before starting the app:\n${formatErrors(errors)}`,
    );
  }

  return validatedConfig;
}
