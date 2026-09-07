import { ApiClientError } from '../services/api';

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiClientError) {
    const map: Record<string, string> = {};
    for (const detail of error.details) {
      const key = detail.field.split('.').pop() || detail.field;
      map[key] = detail.message;
    }
    return map;
  }
  return {};
}
