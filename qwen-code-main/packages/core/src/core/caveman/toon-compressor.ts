/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Caveman TOON (Token-Oriented Object Notation) Compressor.
 *
 * Converts JSON arrays of uniform objects into compact columnar format:
 * `[id,name,role]: 1,alice,admin; 2,bob,user`
 *
 * Saves 50-70% tokens on structured tables, logs, and database records.
 */

export function encodeToon(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Check if value is a candidate array of objects
  if (Array.isArray(value) && value.length >= 2 && value.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))) {
    const keys = Object.keys(value[0]);
    if (keys.length > 0 && value.every((item) => Object.keys(item).length === keys.length && keys.every((k) => k in item))) {
      // Uniform array of objects: format as TOON
      const header = `[${keys.join(',')}]`;
      const rows = value.map((obj) => {
        return keys
          .map((k) => {
            const v = obj[k];
            if (typeof v === 'string') {
              // Escape commas or semicolons if present
              return v.includes(',') || v.includes(';') ? JSON.stringify(v) : v;
            }
            if (v === null) return 'null';
            return String(v);
          })
          .join(',');
      });

      return `${header}: ${rows.join('; ')}`;
    }
  }

  // Fallback to compact JSON
  return JSON.stringify(value);
}
