export const DEBUG: boolean = typeof __DEBUG__ !== 'undefined' ? __DEBUG__ : false;

export interface ErrorRecord {
  at: number;
  where: string;
  message: string;
  stack?: string;
}

const MAX_ERRORS = 20;
const errors: ErrorRecord[] = [];

/** Keep an error in memory for the "Details" panel. Errors are never sent anywhere. */
export function recordError(where: string, err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  errors.push({ at: Date.now(), where, message: e.message, stack: e.stack });
  if (errors.length > MAX_ERRORS) errors.shift();
  console.warn(`[KEX] ${where}:`, e);
}

export function getErrors(): readonly ErrorRecord[] {
  return errors;
}

export const log = {
  debug: (...a: unknown[]): void => {
    if (DEBUG) console.debug('[KEX]', ...a);
  },
  warn: (...a: unknown[]): void => console.warn('[KEX]', ...a),
};
