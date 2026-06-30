/**
 * Error factory used by strict cast helpers.
 */
export type CastErrorFactory = (message: string) => Error;

/**
 * Default error raised by strict cast helpers.
 */
export class CastError extends Error {}

/**
 * Return a shallow copy without undefined values. Example:
 * `compactObject({ a: 1, b: undefined }) => { a: 1 }`.
 */
export function compactObject<T extends Record<string, unknown>>(input: T): Partial<T> {
  const output: Partial<T> = {};
  for (const [key, value] of Object.entries(input) as Array<[keyof T, T[keyof T]]>) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

/**
 * Return a trimmed string when the value is a non-empty string. Examples:
 * `optionalString(" x ") => "x"`, `optionalString(" ") => undefined`,
 * `optionalString(1) => undefined`.
 */
export function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim() || undefined;
}

/**
 * Return a string exactly as provided, including empty strings and surrounding whitespace. Examples:
 * `optionalRawString(" x ") => " x "`, `optionalRawString(1) => undefined`.
 */
export function optionalRawString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Return a string or throw a caller-provided error. Examples:
 * `requiredString(" x ", "name") => "x"`, `requiredString("", "name")` throws.
 */
export function requiredString(
  value: unknown,
  fieldName: string,
  createError: CastErrorFactory = (message) => new CastError(message),
): string {
  const result = optionalString(value);
  if (result) {
    return result;
  }

  throw createError(`${fieldName} is required.`);
}

/**
 * Return a plain object record when the value can be used as JSON object data. Examples:
 * `optionalRecord({ a: 1 }) => { a: 1 }`, `optionalRecord([]) => undefined`.
 */
export function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

/**
 * Keep only non-empty string values and trim them. Example:
 * `stringRecord({ a: " x ", b: 1, c: "" }) => { a: "x" }`.
 */
export function stringRecord(input: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const text = optionalString(value);
    if (text) {
      values[key] = text;
    }
  }
  return values;
}

/**
 * Return an integer if the value is already an integer number. Examples:
 * `optionalInteger(1) => 1`, `optionalInteger("1") => undefined`.
 */
export function optionalInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

/**
 * Return an integer, null, or undefined when the value is not an integer. Examples:
 * `nullableInteger(null) => null`, `nullableInteger(1.2) => undefined`.
 */
export function nullableInteger(value: unknown): number | null | undefined {
  return value === null ? null : optionalInteger(value);
}

/**
 * Return a boolean if the value is already boolean. Examples:
 * `optionalBoolean(false) => false`, `optionalBoolean(1) => undefined`.
 */
export function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Return a string, null, or undefined when the value is not a string. Examples:
 * `nullableString(null) => null`, `nullableString(" x ") => "x"`,
 * `nullableString(1) => undefined`.
 */
export function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : optionalString(value);
}

/**
 * Return a positive integer from a number or numeric string. Examples:
 * `positiveInteger("2", "page") => 2`, `positiveInteger(0, "page")` throws.
 */
export function positiveInteger(
  value: unknown,
  fieldName: string,
  createError: CastErrorFactory = (message) => new CastError(message),
): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  throw createError(`${fieldName} must be a positive integer`);
}
