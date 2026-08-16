/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FunctionDeclaration, Content } from '@google/genai';

/**
 * Tool Detox Options.
 */
export interface ToolDetoxOptions {
  /** Maximum number of dynamic/MCP tools to include in a single turn (default: 8) */
  maxDynamicTools?: number;
  /** Minimum total tool count before pruning kicks in (default: 12) */
  minToolsThreshold?: number;
  /** Additional tool names that must always be retained */
  alwaysRetainTools?: string[];
}

/**
 * Essential core tools that are always retained regardless of query.
 */
const CORE_TOOLS = new Set([
  'run_shell_command',
  'shell',
  'read_file',
  'write_file',
  'edit',
  'grep',
  'grep_search',
  'glob',
  'ask_user_question',
  'todo_write',
  'todo_read',
  'agent',
  'skill',
]);

/**
 * Tokenizes text into normalized lowercase alphanumeric terms.
 */
export function tokenizeText(text: string): Set<string> {
  if (!text || typeof text !== 'string') {
    return new Set();
  }

  // Split on non-alphanumeric characters, underscores, and camelCase boundaries
  const words = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((w) => w.length > 2);

  return new Set(words);
}

/**
 * Scores a tool declaration against a set of query keywords.
 */
export function scoreTool(
  tool: FunctionDeclaration,
  queryTokens: Set<string>,
  recentToolNames: Set<string>,
): number {
  let score = 0;
  const toolName = tool.name ?? '';

  // Strong boost if tool was recently used in session
  if (recentToolNames.has(toolName)) {
    score += 10;
  }

  // Tokenize tool name, description, and parameter keys
  const nameTokens = tokenizeText(toolName);
  const descTokens = tokenizeText(tool.description ?? '');

  let paramTokens = new Set<string>();
  if (tool.parametersJsonSchema && typeof tool.parametersJsonSchema === 'object') {
    const props = (tool.parametersJsonSchema as any).properties;
    if (props && typeof props === 'object') {
      paramTokens = tokenizeText(Object.keys(props).join(' '));
    }
  }

  for (const token of queryTokens) {
    if (nameTokens.has(token)) {
      score += 5;
    }
    if (descTokens.has(token)) {
      score += 2;
    }
    if (paramTokens.has(token)) {
      score += 3;
    }
  }

  return score;
}

/**
 * Extracts recently called tool names from conversation history.
 */
export function extractRecentToolCalls(history?: Content[], maxTurns: number = 3): Set<string> {
  const result = new Set<string>();
  if (!history || !Array.isArray(history)) {
    return result;
  }

  const recentHistory = history.slice(-maxTurns * 2);
  for (const turn of recentHistory) {
    if (turn.parts && Array.isArray(turn.parts)) {
      for (const part of turn.parts) {
        if (part.functionCall && part.functionCall.name) {
          result.add(part.functionCall.name);
        }
        if (part.functionResponse && part.functionResponse.name) {
          result.add(part.functionResponse.name);
        }
      }
    }
  }

  return result;
}

/**
 * Filters and prunes tool declarations dynamically based on user query and session relevance.
 */
export function filterRelevantTools(
  declarations: FunctionDeclaration[],
  userQuery: string,
  history?: Content[],
  options: ToolDetoxOptions = {},
): FunctionDeclaration[] {
  const {
    maxDynamicTools = 8,
    minToolsThreshold = 12,
    alwaysRetainTools = [],
  } = options;

  // If total tools count is below threshold, pass all through without pruning
  if (declarations.length <= minToolsThreshold) {
    return declarations;
  }

  const retainSet = new Set([...CORE_TOOLS, ...alwaysRetainTools]);
  const coreDeclarations: FunctionDeclaration[] = [];
  const dynamicDeclarations: FunctionDeclaration[] = [];

  for (const decl of declarations) {
    const name = decl.name ?? '';
    if (retainSet.has(name)) {
      coreDeclarations.push(decl);
    } else {
      dynamicDeclarations.push(decl);
    }
  }

  // Tokenize user query + last user turn in history
  let combinedQuery = userQuery;
  if (history && history.length > 0) {
    const lastUserTurn = [...history].reverse().find((h) => h.role === 'user');
    if (lastUserTurn?.parts) {
      const textParts = lastUserTurn.parts
        .map((p) => p.text)
        .filter((t): t is string => typeof t === 'string');
      combinedQuery += ' ' + textParts.join(' ');
    }
  }

  const queryTokens = tokenizeText(combinedQuery);
  const recentTools = extractRecentToolCalls(history);

  // Score and rank dynamic tools
  const scoredDynamic = dynamicDeclarations.map((decl) => ({
    decl,
    score: scoreTool(decl, queryTokens, recentTools),
  }));

  // Sort descending by score
  scoredDynamic.sort((a, b) => b.score - a.score);

  // Take top N dynamic tools
  const topDynamic = scoredDynamic.slice(0, maxDynamicTools).map((item) => item.decl);

  return [...coreDeclarations, ...topDynamic];
}
