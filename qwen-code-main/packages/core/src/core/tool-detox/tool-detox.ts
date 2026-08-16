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
  /** Include the find_tools meta-tool for agentic on-demand discovery (default: true) */
  includeMetaTool?: boolean;
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
 * Meta-tool definition for dynamic on-demand tool discovery by the LLM.
 */
export const FIND_TOOLS_DECLARATION: FunctionDeclaration = {
  name: 'find_tools',
  description:
    'Search for and discover additional available tools by capability or domain when a required specialized tool is not in the current active context.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'The capability, service name, or topic to search for (e.g. "database", "slack", "monitoring", "browser", "s3")',
      },
    },
    required: ['query'],
  },
};

/**
 * Domain-specific semantic clusters for expanding search tokens.
 */
const SEMANTIC_DOMAIN_CLUSTERS: Array<Set<string>> = [
  // Database / SQL / Storage
  new Set([
    'db', 'database', 'sql', 'query', 'postgres', 'postgresql', 'mysql', 'sqlite',
    'table', 'schema', 'select', 'insert', 'update', 'orm', 'migration', 'redis', 'mongo',
    'база', 'данных', 'таблица', 'запрос', 'бд',
  ]),
  // Monitoring / Logs / Errors / Crash
  new Set([
    'log', 'logs', 'error', 'errors', 'exception', 'crash', 'sentry', 'datadog',
    'cloudwatch', 'trace', 'tracing', '500', '502', '504', 'status', 'health',
    'пятисотит', 'упал', 'сбой', 'падают', 'логи', 'ошибки', 'мониторинг',
  ]),
  // Browser / Web Automation / Scraping / Screenshots
  new Set([
    'browser', 'web', 'page', 'url', 'screenshot', 'html', 'scrape', 'scraping',
    'playwright', 'puppeteer', 'selenium', 'dom', 'click', 'navigate', 'capture',
    'слепок', 'экран', 'скриншот', 'браузер', 'страница',
  ]),
  // Git / GitHub / Version Control / PRs / Issues
  new Set([
    'git', 'github', 'gitlab', 'pr', 'pull', 'issue', 'issues', 'commit',
    'repo', 'repository', 'branch', 'merge', 'diff', 'коммит', 'пулл', 'ветка', 'репозиторий',
  ]),
  // Cloud / Infrastructure / DevOps / S3 / Deploy
  new Set([
    'cloud', 'aws', 's3', 'gcp', 'azure', 'k8s', 'kubernetes', 'docker',
    'container', 'deploy', 'deployment', 'bucket', 'деплой', 'контейнер', 'кластер',
  ]),
  // Communication / Slack / Discord / Notifications
  new Set([
    'slack', 'discord', 'telegram', 'email', 'notify', 'notification',
    'channel', 'message', 'уведомление', 'сообщение', 'чат', 'канал',
  ]),
];

/**
 * Tokenizes text into normalized lowercase alphanumeric terms.
 */
export function tokenizeText(text: string): Set<string> {
  if (!text || typeof text !== 'string') {
    return new Set();
  }

  const words = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9а-яё_]+/)
    .filter((w) => w.length >= 2);

  return new Set(words);
}

/**
 * Expands query tokens using semantic domain clusters.
 */
export function expandSemanticTokens(queryTokens: Set<string>): Set<string> {
  const expanded = new Set<string>(queryTokens);

  for (const token of queryTokens) {
    for (const cluster of SEMANTIC_DOMAIN_CLUSTERS) {
      if (cluster.has(token)) {
        for (const synonym of cluster) {
          expanded.add(synonym);
        }
      }
    }
  }

  return expanded;
}

/**
 * Scores a tool declaration using Tier 1 (lexical match) + Tier 2 (semantic domain expansion).
 */
export function scoreTool(
  tool: FunctionDeclaration,
  directQueryTokens: Set<string>,
  expandedTokens: Set<string>,
  recentToolNames: Set<string>,
): number {
  let score = 0;
  const toolName = tool.name ?? '';

  // Strong boost if tool was recently used in the active session
  if (recentToolNames.has(toolName)) {
    score += 15;
  }

  const nameTokens = tokenizeText(toolName);
  const descTokens = tokenizeText(tool.description ?? '');

  let paramTokens = new Set<string>();
  if (tool.parametersJsonSchema && typeof tool.parametersJsonSchema === 'object') {
    const props = (tool.parametersJsonSchema as any).properties;
    if (props && typeof props === 'object') {
      paramTokens = tokenizeText(Object.keys(props).join(' '));
    }
  }

  // Tier 1: Direct exact keyword hits (Highest Weight)
  for (const token of directQueryTokens) {
    if (nameTokens.has(token)) {
      score += 10;
    }
    if (descTokens.has(token)) {
      score += 5;
    }
    if (paramTokens.has(token)) {
      score += 6;
    }
  }

  // Tier 2: Semantic Domain synonym hits
  for (const token of expandedTokens) {
    if (!directQueryTokens.has(token)) {
      if (nameTokens.has(token)) {
        score += 4;
      }
      if (descTokens.has(token)) {
        score += 2;
      }
      if (paramTokens.has(token)) {
        score += 3;
      }
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
 * Filters and prunes tool declarations dynamically using a 3-tier cascaded approach.
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
    includeMetaTool = true,
    alwaysRetainTools = [],
  } = options;

  // If total tools count is below threshold, pass all through
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

  // Combine query and recent user input
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

  const directQueryTokens = tokenizeText(combinedQuery);
  const expandedTokens = expandSemanticTokens(directQueryTokens);
  const recentTools = extractRecentToolCalls(history);

  // Score and rank dynamic tools
  const scoredDynamic = dynamicDeclarations.map((decl) => ({
    decl,
    score: scoreTool(decl, directQueryTokens, expandedTokens, recentTools),
  }));

  // Sort descending by score
  scoredDynamic.sort((a, b) => b.score - a.score);

  // Select top N dynamic tools
  const topDynamic = scoredDynamic.slice(0, maxDynamicTools).map((item) => item.decl);

  const result = [...coreDeclarations, ...topDynamic];

  // Tier 3: Add find_tools meta-tool if enabled
  if (includeMetaTool && !result.some((t) => t.name === 'find_tools')) {
    result.push(FIND_TOOLS_DECLARATION);
  }

  return result;
}
