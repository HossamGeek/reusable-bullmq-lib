const DEFAULT_CONFLICT_MESSAGE = 'Job operation conflict';

export function conflictMessageFrom(err: unknown): string {
  if (err instanceof Error && typeof err.message === 'string' && err.message.length > 0) {
    return err.message;
  }

  return DEFAULT_CONFLICT_MESSAGE;
}
