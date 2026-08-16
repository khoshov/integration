/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './context-crusher.js';
export * from './cache-aligner.js';

import type { Content } from '@google/genai';
import { applyLiveZoneTrimming, type ContextCrusherOptions } from './context-crusher.js';

/**
 * Optimizes conversation history using Headroom context crushing and Live Zone protection.
 */
export function optimizeContextWithHeadroom(
  history: Content[],
  options?: ContextCrusherOptions,
): Content[] {
  return applyLiveZoneTrimming(history, options);
}
