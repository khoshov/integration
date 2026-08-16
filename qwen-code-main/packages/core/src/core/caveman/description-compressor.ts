/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Caveman Semantic Constraint Description Compressor.
 *
 * Reduces free-text tool descriptions by retaining:
 * 1. The selection lead (the first sentence, capped at maxLeadLen).
 * 2. Every constraint-bearing sentence (must/required/range/format/RFC/ISO).
 *
 * Drops verbose prose, conversational filler, and redundant examples.
 */

const CONSTRAINT_REGEX =
  /\b(?:must|must not|cannot|can't|shall|require\w*|reject\w*|disallow\w*|forbidden|invalid|not allowed|not permitted|exactly one|only one of|one of|at least|at most|mutually exclusive|only|unique|case[- ]?sensitive|max|min|maximum|minimum|range|between|greater than|less than|more than|fewer than|no more than|no less than|over|above|below|under|beyond|exceed\w*|format\w*|iso[- ]?\d*|rfc[- ]?\d*|absolute)\b/i;

function hasConstraintMarker(sentence: string): boolean {
  return CONSTRAINT_REGEX.test(sentence);
}

function splitSentences(text: string): string[] {
  // Matches sentence terminators (.!?) followed by whitespace or end of string
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Compresses an MCP tool or parameter description.
 */
export function compressToolDescription(
  desc: string | undefined | null,
  maxLeadLen: number = 80,
): string {
  if (!desc || typeof desc !== 'string') {
    return '';
  }

  const trimmed = desc.trim();
  // If description is already very short (< 160 chars), keep whole to avoid losing nuances
  if (trimmed.length <= maxLeadLen * 2) {
    return trimmed;
  }

  const sentences = splitSentences(trimmed);
  if (sentences.length <= 1) {
    if (trimmed.length <= maxLeadLen) {
      return trimmed;
    }
    return trimmed.slice(0, maxLeadLen - 3).trimEnd() + '...';
  }

  const kept: string[] = [];
  let leadTaken = false;

  for (const sentence of sentences) {
    if (hasConstraintMarker(sentence)) {
      kept.push(sentence);
    } else if (!leadTaken) {
      let lead = sentence;
      if (lead.length > maxLeadLen) {
        lead = lead.slice(0, maxLeadLen - 3).trimEnd() + '...';
      }
      kept.push(lead);
      leadTaken = true;
    }
  }

  if (kept.length === 0 && sentences.length > 0) {
    let lead = sentences[0];
    if (lead.length > maxLeadLen) {
      lead = lead.slice(0, maxLeadLen - 3).trimEnd() + '...';
    }
    kept.push(lead);
  }

  return kept.join(' ');
}
