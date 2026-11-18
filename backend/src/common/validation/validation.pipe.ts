/**
 * Global request validation (ADR-007, ADR-013).
 *
 * Nest 12's StandardSchemaValidationPipe validates every parameter that declares a zod schema:
 *   @Body({ schema: createListingSchema }) body: CreateListingInput
 *   @Param('id', { schema: uuidSchema }) id: string
 *
 * This wrapper only changes the error format to our standard VALIDATION_FAILED shape.
 *
 * ⚠ A parameter WITHOUT a schema is not validated. Every @Body/@Query must have one —
 *   enforced by the route-schema test (roadmap T1.9).
 */
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { AppError, type ValidationIssue } from '../errors/app-error.js';

type IssuePath = ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined;

export function formatIssuePath(path: IssuePath): string {
  if (!path) return '';
  return path.map((segment) => String(typeof segment === 'object' ? segment.key : segment)).join('.');
}

export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    transform: true,
    exceptionFactory: (issues) => {
      const details: ValidationIssue[] = issues.map((issue) => ({
        path: formatIssuePath(issue.path),
        message: issue.message,
      }));
      return AppError.badRequest('VALIDATION_FAILED', 'Some fields are missing or invalid', details);
    },
  });
}
