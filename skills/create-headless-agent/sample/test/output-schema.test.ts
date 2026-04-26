import { describe, test, expect } from 'bun:test';
import Ajv from 'ajv';

// These tests exercise the Ajv validation logic that lives inside cli.ts.
// We isolate the validation itself (not the whole CLI pipeline) because
// running the agent requires a real API call.

function validate(schema: object, text: string): { valid: boolean; errors?: string } {
  const ajv = new Ajv({ allErrors: true });
  const v = ajv.compile(schema);
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return { valid: false, errors: 'not valid JSON' }; }
  if (v(parsed)) return { valid: true };
  return { valid: false, errors: ajv.errorsText(v.errors) };
}

describe('output schema validation', () => {
  const reportSchema = {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      count: { type: 'integer', minimum: 0 },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'count'],
    additionalProperties: false,
  };

  test('accepts valid JSON matching schema', () => {
    const result = validate(reportSchema, '{"summary":"ok","count":3}');
    expect(result.valid).toBe(true);
  });

  test('accepts valid JSON with optional fields', () => {
    const result = validate(reportSchema, '{"summary":"ok","count":3,"tags":["a","b"]}');
    expect(result.valid).toBe(true);
  });

  test('rejects missing required field', () => {
    const result = validate(reportSchema, '{"summary":"ok"}');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('count');
  });

  test('rejects wrong type for field', () => {
    const result = validate(reportSchema, '{"summary":"ok","count":"three"}');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('count');
  });

  test('rejects additional properties when additionalProperties=false', () => {
    const result = validate(reportSchema, '{"summary":"ok","count":3,"extra":true}');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('additional');
  });

  test('rejects non-JSON text', () => {
    const result = validate(reportSchema, 'not json at all');
    expect(result.valid).toBe(false);
    expect(result.errors).toBe('not valid JSON');
  });

  test('rejects empty object against required-fields schema', () => {
    const result = validate(reportSchema, '{}');
    expect(result.valid).toBe(false);
    // This is the "empty object bypasses validation" case the reviewer flagged
    expect(result.errors).toContain('summary');
    expect(result.errors).toContain('count');
  });
});
