/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { compressJsonSchema, compressMcpTools } from './schema-compressor.js';

describe('MCPU schema-compressor', () => {
  it('strips redundant $schema, title, and additionalProperties: false', () => {
    const rawSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'ReadFileParams',
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          title: 'Path',
          type: 'string',
          description: 'The file path to read from disk',
        },
        encoding: {
          title: 'Encoding',
          type: 'string',
          default: 'utf-8',
        },
      },
      required: ['path'],
    };

    const compressed = compressJsonSchema(rawSchema);

    expect(compressed['$schema']).toBeUndefined();
    expect(compressed['title']).toBeUndefined();
    expect(compressed['additionalProperties']).toBeUndefined();
    expect(compressed['type']).toBe('object');
    expect((compressed['properties'] as any).path.title).toBeUndefined();
    expect((compressed['properties'] as any).path.type).toBe('string');
    expect(compressed['required']).toEqual(['path']);

    const rawSize = JSON.stringify(rawSchema).length;
    const compressedSize = JSON.stringify(compressed).length;
    expect(compressedSize).toBeLessThan(rawSize * 0.7);
  });

  it('simplifies union types from anyOf to type array', () => {
    const schema = {
      type: 'object',
      properties: {
        limit: {
          anyOf: [{ type: 'number' }, { type: 'null' }],
        },
      },
    };

    const compressed = compressJsonSchema(schema);
    expect((compressed['properties'] as any).limit.type).toEqual(['number', 'null']);
    expect((compressed['properties'] as any).limit.anyOf).toBeUndefined();
  });

  it('handles empty or non-object schemas gracefully', () => {
    expect(compressJsonSchema(null)).toEqual({});
    expect(compressJsonSchema(undefined)).toEqual({});
  });

  it('compresses tool list declarations with compressMcpTools', () => {
    const tools = [
      {
        name: 'test_tool',
        description: 'A test tool',
        parametersJsonSchema: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
          properties: {
            arg: { type: 'string', title: 'Arg' },
          },
        },
      },
    ];

    const compressedTools = compressMcpTools(tools);
    expect(compressedTools[0].parametersJsonSchema!['$schema']).toBeUndefined();
    expect((compressedTools[0].parametersJsonSchema!['properties'] as any).arg.title).toBeUndefined();
  });
});
