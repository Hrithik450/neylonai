/**
 * Input validation utilities for API routes
 */

export interface ValidationError {
  field: string;
  message: string;
}

export class InputValidationError extends Error {
  constructor(
    public errors: ValidationError[],
    message = "Input validation failed",
  ) {
    super(message);
    this.name = "InputValidationError";
  }
}

export interface StringValidationOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  required?: boolean;
}

export function validateString(
  value: unknown,
  field: string,
  options: StringValidationOptions = {},
): string {
  const { minLength, maxLength, pattern, required = true } = options;

  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new InputValidationError([{ field, message: `${field} is required` }]);
    }
    return "";
  }

  if (typeof value !== "string") {
    throw new InputValidationError([{ field, message: `${field} must be a string` }]);
  }

  if (minLength !== undefined && value.length < minLength) {
    throw new InputValidationError([
      { field, message: `${field} must be at least ${minLength} characters` },
    ]);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new InputValidationError([
      { field, message: `${field} must not exceed ${maxLength} characters` },
    ]);
  }

  if (pattern && !pattern.test(value)) {
    throw new InputValidationError([
      { field, message: `${field} format is invalid` },
    ]);
  }

  return value;
}

export function validateEmail(value: unknown, field = "email"): string {
  const email = validateString(value, field, {
    maxLength: 320,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  });
  return email.toLowerCase();
}

export function validateUUID(value: unknown, field = "id"): string {
  return validateString(value, field, {
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  });
}

export function validateEnum<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[],
): T {
  if (typeof value !== "string") {
    throw new InputValidationError([{ field, message: `${field} must be a string` }]);
  }

  if (!allowedValues.includes(value as T)) {
    throw new InputValidationError([
      {
        field,
        message: `${field} must be one of: ${allowedValues.join(", ")}`,
      },
    ]);
  }

  return value as T;
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeString(value: string): string {
  return value
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize content fields (messages, descriptions, etc.)
 */
export function validateContent(
  value: unknown,
  field: string,
  maxLength = 10000,
): string {
  const content = validateString(value, field, { maxLength });

  // Check for excessive whitespace or control characters
  if (content.length > 0 && /^\s*$/.test(content)) {
    throw new InputValidationError([
      { field, message: `${field} cannot be empty or only whitespace` },
    ]);
  }

  return content;
}

/**
 * Validate object shape with multiple fields
 */
export function validateObject<T extends Record<string, unknown>>(
  obj: unknown,
  validators: {
    [K in keyof T]: (value: unknown, field: string) => T[K];
  },
): T {
  if (!obj || typeof obj !== "object") {
    throw new InputValidationError([
      { field: "body", message: "Request body must be an object" },
    ]);
  }

  const errors: ValidationError[] = [];
  const result: Partial<T> = {};

  for (const [field, validator] of Object.entries(validators) as [keyof T, (v: unknown, f: string) => T[keyof T]][]) {
    try {
      result[field] = validator((obj as Record<string, unknown>)[field as string], field as string);
    } catch (error) {
      if (error instanceof InputValidationError) {
        errors.push(...error.errors);
      } else {
        errors.push({
          field: field as string,
          message: error instanceof Error ? error.message : "Validation failed",
        });
      }
    }
  }

  if (errors.length > 0) {
    throw new InputValidationError(errors);
  }

  return result as T;
}
