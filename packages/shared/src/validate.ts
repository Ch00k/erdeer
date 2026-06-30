import { parseAml } from "@azimutt/aml";

export interface SourcePosition {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface ValidationError {
  message: string;
  position: SourcePosition;
}

export type ValidationResult =
  | { valid: true; entities: number; relations: number; types: number }
  | { valid: false; errors: ValidationError[] };

export function validateAml(content: string): ValidationResult {
  const result = parseAml(content);

  if (result.errors && result.errors.length > 0) {
    return {
      valid: false,
      errors: result.errors.map((e) => ({ message: e.message, position: e.position })),
    };
  }

  return {
    valid: true,
    entities: result.result?.entities?.length ?? 0,
    relations: result.result?.relations?.length ?? 0,
    types: result.result?.types?.length ?? 0,
  };
}
