/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Headroom Cache Aligner.
 *
 * Stabilizes system prompts and prefix instructions to ensure maximum
 * KV-cache hit rate across Anthropic, OpenAI, and Gemini model providers.
 */

export function alignCachePrefix(
  systemPrompt: string,
  staticInstructions: string = '',
): string {
  const parts: string[] = [];

  if (systemPrompt && systemPrompt.trim()) {
    // Normalize newlines and trim trailing whitespace per line
    const normalizedPrompt = systemPrompt
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')
      .trim();
    parts.push(normalizedPrompt);
  }

  if (staticInstructions && staticInstructions.trim()) {
    const normalizedInstructions = staticInstructions
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trimEnd())
      .join('\n')
      .trim();
    parts.push(normalizedInstructions);
  }

  return parts.join('\n\n');
}
