/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  crushLogOutput,
  crushJsonOutput,
  applyLiveZoneTrimming,
} from './context-crusher.js';
import { alignCachePrefix } from './cache-aligner.js';

describe('Headroom context crusher', () => {
  it('collapses repeated lines in long logs', () => {
    const rawLogs = [
      'Server starting...',
      'GET /health 200',
      'GET /health 200',
      'GET /health 200',
      'GET /health 200',
      'GET /health 200',
      'Done initialization.',
    ].join('\n');

    const crushed = crushLogOutput(rawLogs);
    expect(crushed).toContain('GET /health 200');
    expect(crushed).toContain('[... repeated 4 more times]');
    expect(crushed).toContain('Done initialization.');
  });

  it('compacts formatted JSON output', () => {
    const rawJson = JSON.stringify({ status: 'ok', items: [1, 2, 3] }, null, 2);
    const crushed = crushJsonOutput(rawJson);
    expect(crushed).toBe('{"status":"ok","items":[1,2,3]}');
  });

  it('protects Live Zone and crushes older turns in history', () => {
    const history = [
      // Old turn (should be crushed)
      {
        role: 'user',
        parts: [{ text: 'Check logs' }],
      },
      {
        role: 'model',
        parts: [
          {
            functionResponse: {
              name: 'shell',
              response: {
                output: [
                  'polling status...',
                  'polling status...',
                  'polling status...',
                  'polling status...',
                  'polling status...',
                  'ready',
                ].join('\n'),
              },
            },
          },
        ],
      },
      // Live Zone turns (should be intact)
      {
        role: 'user',
        parts: [{ text: 'Current active question' }],
      },
      {
        role: 'model',
        parts: [{ text: 'Active response' }],
      },
    ];

    const optimized = applyLiveZoneTrimming(history, { liveZoneTurns: 1 });
    const oldToolOutput = (optimized[1].parts[0] as any).functionResponse.response.output;
    expect(oldToolOutput).toContain('[... repeated');

    const liveTurn = optimized[2].parts[0].text;
    expect(liveTurn).toBe('Current active question');
  });

  it('aligns and normalizes cache prefixes', () => {
    const prompt = 'You are an AI.\r\nBe helpful.   \n';
    const instructions = 'Rule 1: Always be concise.\r\n';
    const aligned = alignCachePrefix(prompt, instructions);
    expect(aligned).toBe('You are an AI.\nBe helpful.\n\nRule 1: Always be concise.');
  });
});
