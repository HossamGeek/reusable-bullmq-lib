export function parseIntEnv(value: string | undefined, fallback: number, min = 0): number {
  const n = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(n) || n < min) throw new Error(`Invalid numeric env value: ${value}`);
  return n;
}
export function optionalString(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}
