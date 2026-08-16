/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Headroom Context Crusher.
 *
 * Provides intelligent text and JSON context compression for LLM agent histories:
 * 1. Log Deduplication (collapses repeated polling/progress lines).
 * 2. Stack Trace Compression (trims repetitive frame noise).
 * 3. JSON Crushing (strips redundant nulls and minifies structure).
 * 4. Live Zone Protection (keeps recent N turns in 100% full fidelity).
 */

export interface ContextCrusherOptions {
  /** Number of latest turns to protect in full fidelity without compression (default: 3) */
  liveZoneTurns?: number;
  /** Maximum length for a single old tool output before crushing (default: 1000) */
  maxToolOutputChars?: number;
}

/**
 * Collapses repeating consecutive lines and trims stack traces.
 */
export function crushLogOutput(text: string): string {
  if (!text || text.length < 100) {
    return text;
  }

  const lines = text.split('\n');
  if (lines.length < 5) {
    return text;
  }

  const compressedLines: string[] = [];
  let currentLine = lines[0];
  let repeatCount = 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === currentLine && line.trim().length > 0) {
      repeatCount++;
    } else {
      if (repeatCount > 2) {
        compressedLines.push(currentLine);
        compressedLines.push(`  [... repeated ${repeatCount - 1} more times]`);
      } else {
        for (let r = 0; r < repeatCount; r++) {
          compressedLines.push(currentLine);
        }
      }
      currentLine = line;
      repeatCount = 1;
    }
  }

  if (repeatCount > 2) {
    compressedLines.push(currentLine);
    compressedLines.push(`  [... repeated ${repeatCount - 1} more times]`);
  } else {
    for (let r = 0; r < repeatCount; r++) {
      compressedLines.push(currentLine);
    }
  }

  // Compress repetitive stack trace frames: "at ..."
  const traceReduced: string[] = [];
  let inStackTrace = false;
  let stackFrameCount = 0;
  const maxStackFrames = 5;

  for (const line of compressedLines) {
    const isStackFrame = /^\s*at\s+/.test(line);
    if (isStackFrame) {
      inStackTrace = true;
      stackFrameCount++;
      if (stackFrameCount <= maxStackFrames) {
        traceReduced.push(line);
      } else if (stackFrameCount === maxStackFrames + 1) {
        traceReduced.push('    [... additional stack frames omitted]');
      }
    } else {
      if (inStackTrace) {
        inStackTrace = false;
        stackFrameCount = 0;
      }
      traceReduced.push(line);
    }
  }

  return traceReduced.join('\n');
}

/**
 * Compacts JSON output by stripping excess whitespace and null properties.
 */
export function crushJsonOutput(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return text;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed);
  } catch {
    return text;
  }
}

/**
 * Optimizes a generic tool result text.
 */
export function crushToolOutput(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const jsonCrushed = crushJsonOutput(trimmed);
    if (jsonCrushed !== trimmed) {
      return jsonCrushed;
    }
  }

  return crushLogOutput(text);
}

/**
 * Applies Live Zone protection to conversation history.
 * Protects the latest `liveZoneTurns` turns and optimizes earlier turns.
 */
export function applyLiveZoneTrimming<T extends { role?: string; parts?: Array<any> }>(
  history: T[],
  options: ContextCrusherOptions = {},
): T[] {
  if (!Array.isArray(history) || history.length === 0) {
    return history;
  }

  const { liveZoneTurns = 3 } = options;
  const splitIndex = Math.max(0, history.length - liveZoneTurns * 2);

  return history.map((content, idx) => {
    // Within Live Zone: keep 100% uncompressed
    if (idx >= splitIndex || !content.parts || !Array.isArray(content.parts)) {
      return content;
    }

    // Older history: crush functionResponse outputs and long text parts
    const optimizedParts = content.parts.map((part) => {
      if (part.functionResponse && part.functionResponse.response) {
        const resp = part.functionResponse.response;
        if (typeof resp.output === 'string') {
          return {
            ...part,
            functionResponse: {
              ...part.functionResponse,
              response: {
                ...resp,
                output: crushToolOutput(resp.output),
              },
            },
          };
        }
      }

      if (typeof part.text === 'string' && part.text.length > 500) {
        return {
          ...part,
          text: crushToolOutput(part.text),
        };
      }

      return part;
    });

    return {
      ...content,
      parts: optimizedParts,
    };
  });
}
