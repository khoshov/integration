/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { compressToolDescription } from './description-compressor.js';
import { encodeToon } from './toon-compressor.js';

describe('Caveman Description Compressor', () => {
  it('retains lead sentence and constraints while dropping filler prose', () => {
    const longDesc = [
      'Executes a database query against the configured cluster.',
      'This tool is very helpful when you want to look at tables and inspect schemas in detail.',
      'For example, you can query customer records or orders.',
      'The query parameter must be a valid SQL string.',
      'Results are limited to at most 500 rows.',
      'Feel free to use it anytime you need database access.',
    ].join(' ');

    const compressed = compressToolDescription(longDesc);

    expect(compressed).toContain('Executes a database query');
    expect(compressed).toContain('must be a valid SQL string');
    expect(compressed).toContain('at most 500 rows');
    expect(compressed).not.toContain('very helpful when you want to look');
    expect(compressed).not.toContain('Feel free to use it');
  });

  it('keeps short descriptions verbatim', () => {
    const shortDesc = 'Reads file contents from disk.';
    expect(compressToolDescription(shortDesc)).toBe(shortDesc);
  });
});

describe('Caveman TOON JSON Compressor', () => {
  it('converts uniform arrays of objects into compact TOON notation', () => {
    const data = [
      { id: 1, name: 'Alice', role: 'admin' },
      { id: 2, name: 'Bob', role: 'user' },
      { id: 3, name: 'Charlie', role: 'guest' },
    ];

    const toon = encodeToon(data);
    expect(toon).toBe('[id,name,role]: 1,Alice,admin; 2,Bob,user; 3,Charlie,guest');

    const rawJsonLen = JSON.stringify(data).length;
    const toonLen = toon.length;
    expect(toonLen).toBeLessThan(rawJsonLen);
  });

  it('falls back to compact JSON for non-uniform objects', () => {
    const mixed = [{ a: 1 }, { b: 2 }];
    expect(encodeToon(mixed)).toBe(JSON.stringify(mixed));
  });
});
