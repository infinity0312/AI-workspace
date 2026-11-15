import { HttpException } from '@nestjs/common';
import { z } from 'zod';

export class AppError extends HttpException {
  constructor(status: number, readonly code: string, message: string, readonly details: unknown = {}, readonly retryable = false) {
    super(message, status);
  }
}
export const missing = (name: string) => new AppError(404, 'RESOURCE_NOT_FOUND', name + ' unavailable');
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);
export const denied = () => new AppError(403, 'PERMISSION_DENIED', 'Permission denied');
export const invalid = (message: string) => new AppError(422, 'VALIDATION_INPUT', message);
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }));
    throw new AppError(422, 'VALIDATION_SCHEMA', 'Request did not match schema', { issues });
  }
  return result.data;
}
