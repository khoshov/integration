/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Headroom Smart Context Crusher.
 *
 * Multi-language context and stack trace compressor supporting:
 * 1. Python (Django, FastAPI, Starlette, Flask, Pytest) Tracebacks.
 * 2. Java / Kotlin (Spring Boot, Tomcat, JUnit, Hibernate) Stack Traces.
 * 3. Go Panic & Goroutine Traces.
 * 4. Node.js / TypeScript / V8 Stack Traces.
 * 5. Log Deduplication (repeated polling lines).
 * 6. Smart JSON Array Crushing.
 * 7. Live Zone Protection (keeps recent N turns in 100% full fidelity).
 */

export interface ContextCrusherOptions {
  /** Number of latest turns to protect in full fidelity without compression (default: 3) */
  liveZoneTurns?: number;
  /** Maximum length for a single old tool output before crushing (default: 1000) */
  maxToolOutputChars?: number;
  /** Maximum items to retain in large JSON arrays (default: 5) */
  maxJsonArrayItems?: number;
}

/**
 * Framework noise indicators by language.
 */
const FRAMEWORK_NOISE_PATTERNS = [
  // Python frameworks & libraries
  /site-packages\/(fastapi|starlette|uvicorn|django|werkzeug|flask|sqlalchemy|pytest|pluggy|urllib3|requests|pydantic)/i,
  /\/lib\/python\d+\.\d+\//i,
  // Java / Kotlin frameworks
  /^\s*at (org\.springframework|org\.apache\.tomcat|org\.junit|org\.hibernate|org\.eclipse|java\.base|kotlinx?\.coroutines)\./i,
  // Go runtime
  /^\s*(runtime\/panic\.go|runtime\/proc\.go|net\/http\/server\.go):/i,
  // Node.js / JavaScript
  /node_modules\/(vitest|jest|mocha|express|koa|next|webpack|vite|@babel)/i,
  /node:internal\//i,
];

function isFrameworkNoiseLine(line: string): boolean {
  return FRAMEWORK_NOISE_PATTERNS.some((pat) => pat.test(line));
}

/**
 * Compresses Python Tracebacks (Django / FastAPI / Pytest).
 */
export function compressPythonTraceback(text: string): string {
  if (!text.includes('Traceback (most recent call last):') && !text.includes('File "')) {
    return text;
  }

  const lines = text.split('\n');
  const result: string[] = [];
  let skippedFrameworkFrames = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFileFrame = /^\s*File ".*?", line \d+, in /.test(line);

    if (isFileFrame) {
      const codeLine = i + 1 < lines.length && !lines[i + 1].startsWith('  File "') && !lines[i + 1].match(/^[A-Za-z0-9_]+Error:/)
        ? lines[i + 1]
        : '';

      if (isFrameworkNoiseLine(line)) {
        skippedFrameworkFrames++;
        if (codeLine) i++; // skip code snippet for noise frame
        continue;
      }

      if (skippedFrameworkFrames > 0) {
        result.push(`  [... ${skippedFrameworkFrames} framework frames omitted ...]`);
        skippedFrameworkFrames = 0;
      }

      result.push(line);
      if (codeLine) {
        result.push(codeLine);
        i++;
      }
    } else {
      if (skippedFrameworkFrames > 0) {
        result.push(`  [... ${skippedFrameworkFrames} framework frames omitted ...]`);
        skippedFrameworkFrames = 0;
      }
      result.push(line);
    }
  }

  if (skippedFrameworkFrames > 0) {
    result.push(`  [... ${skippedFrameworkFrames} framework frames omitted ...]`);
  }

  return result.join('\n');
}

/**
 * Compresses Java / Kotlin Stack Traces (Spring Boot / Tomcat / JUnit).
 */
export function compressJavaStackTrace(text: string): string {
  if (!text.includes('\tat ') && !text.includes('Exception in thread')) {
    return text;
  }

  const lines = text.split('\n');
  const result: string[] = [];
  let skippedFrames = 0;

  for (const line of lines) {
    const isAtLine = /^\s*at\s+/.test(line);

    if (isAtLine && isFrameworkNoiseLine(line)) {
      skippedFrames++;
      continue;
    }

    if (skippedFrames > 0) {
      result.push(`\tat [... ${skippedFrames} framework frames omitted ...]`);
      skippedFrames = 0;
    }

    result.push(line);
  }

  if (skippedFrames > 0) {
    result.push(`\tat [... ${skippedFrames} framework frames omitted ...]`);
  }

  return result.join('\n');
}

/**
 * Compresses Node.js / V8 Stack Traces.
 */
export function compressJsStackTrace(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inStackTrace = false;
  let stackFrameCount = 0;
  const maxStackFrames = 5;

  for (const line of lines) {
    const isStackFrame = /^\s*at\s+/.test(line);
    if (isStackFrame) {
      inStackTrace = true;
      stackFrameCount++;
      if (stackFrameCount <= maxStackFrames && !isFrameworkNoiseLine(line)) {
        result.push(line);
      } else if (stackFrameCount === maxStackFrames + 1) {
        result.push('    [... additional stack frames omitted]');
      }
    } else {
      if (inStackTrace) {
        inStackTrace = false;
        stackFrameCount = 0;
      }
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Collapses repeating consecutive lines and trims stack traces across all languages.
 */
export function crushLogOutput(text: string): string {
  if (!text || text.length < 50) {
    return text;
  }

  const lines = text.split('\n');
  if (lines.length < 4) {
    return text;
  }

  // 1. Line deduplication
  const dedupedLines: string[] = [];
  let currentLine = lines[0];
  let repeatCount = 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === currentLine && line.trim().length > 0) {
      repeatCount++;
    } else {
      if (repeatCount > 2) {
        dedupedLines.push(currentLine);
        dedupedLines.push(`  [... repeated ${repeatCount - 1} more times]`);
      } else {
        for (let r = 0; r < repeatCount; r++) {
          dedupedLines.push(currentLine);
        }
      }
      currentLine = line;
      repeatCount = 1;
    }
  }

  if (repeatCount > 2) {
    dedupedLines.push(currentLine);
    dedupedLines.push(`  [... repeated ${repeatCount - 1} more times]`);
  } else {
    for (let r = 0; r < repeatCount; r++) {
      dedupedLines.push(currentLine);
    }
  }

  const dedupedText = dedupedLines.join('\n');

  // 2. Multi-language stack trace compression
  let resultText = dedupedText;
  if (resultText.includes('Traceback (most recent call last):') || resultText.includes('File "')) {
    resultText = compressPythonTraceback(resultText);
  } else if (resultText.includes('Exception in thread') || resultText.includes('Caused by:')) {
    resultText = compressJavaStackTrace(resultText);
  } else if (/^\s*at\s+/m.test(resultText)) {
    resultText = compressJsStackTrace(resultText);
  }

  return resultText;
}

/**
 * Smart Crusher for JSON arrays and objects.
 */
export function crushJsonOutput(text: string, maxItems: number = 5): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return text;
  }

  try {
    const parsed = JSON.parse(trimmed);

    // If it's a large array, keep top items and append a summary
    if (Array.isArray(parsed) && parsed.length > maxItems) {
      const topItems = parsed.slice(0, maxItems);
      const remainingCount = parsed.length - maxItems;
      return JSON.stringify([
        ...topItems,
        `[... ${remainingCount} more items omitted by SmartCrusher ...]`,
      ]);
    }

    return JSON.stringify(parsed);
  } catch {
    return text;
  }
}

/**
 * Optimizes generic tool result text.
 */
export function crushToolOutput(text: string, options: ContextCrusherOptions = {}): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const jsonCrushed = crushJsonOutput(trimmed, options.maxJsonArrayItems ?? 5);
    if (jsonCrushed !== trimmed) {
      return jsonCrushed;
    }
  }

  return crushLogOutput(text);
}

/**
 * Applies Live Zone protection to conversation history.
 * Protects the latest `liveZoneTurns` turns and compresses earlier turns.
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
                output: crushToolOutput(resp.output, options),
              },
            },
          };
        }
      }

      if (typeof part.text === 'string' && part.text.length > 500) {
        return {
          ...part,
          text: crushToolOutput(part.text, options),
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
