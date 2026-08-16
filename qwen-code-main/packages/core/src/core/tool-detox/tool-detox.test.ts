/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { filterRelevantTools, FIND_TOOLS_DECLARATION } from './tool-detox.js';

describe('3-Tier Cascaded Tool Detox', () => {
  const coreTools = [
    { name: 'shell', description: 'Run a shell command' },
    { name: 'read_file', description: 'Read a file from disk' },
    { name: 'edit', description: 'Edit a file' },
    { name: 'grep', description: 'Search patterns in files' },
    { name: 'glob', description: 'Find files matching pattern' },
    { name: 'ask_user_question', description: 'Ask the user a question' },
  ];

  const mcpTools = [
    {
      name: 'postgres_query',
      description: 'Execute SQL queries against the connected PostgreSQL database',
      parametersJsonSchema: { properties: { sql: { type: 'string' } } },
    },
    {
      name: 'postgres_list_tables',
      description: 'List tables in the PostgreSQL database',
    },
    {
      name: 'sentry_get_issues',
      description: 'Fetch application exceptions, errors, and crash reports',
    },
    {
      name: 'datadog_query_logs',
      description: 'Query production system metrics and server logs',
    },
    {
      name: 'github_create_pr',
      description: 'Open a pull request on GitHub repository',
      parametersJsonSchema: { properties: { title: { type: 'string' }, branch: { type: 'string' } } },
    },
    {
      name: 'slack_send_message',
      description: 'Send a notification message to a Slack channel',
    },
    {
      name: 'playwright_capture_screenshot',
      description: 'Capture a browser view and snapshot of the webpage',
    },
    {
      name: 's3_upload_file',
      description: 'Upload an artifact to AWS S3 bucket',
    },
  ];

  const allTools = [...coreTools, ...mcpTools];

  it('Tier 1: Direct lexical match matches exact keywords instantly', () => {
    const result = filterRelevantTools(allTools, 'Please run postgres query to check users', undefined, {
      maxDynamicTools: 2,
      minToolsThreshold: 8,
    });

    const resultNames = result.map((t) => t.name);
    expect(resultNames).toContain('postgres_query');
    expect(resultNames).toContain('shell');
    expect(resultNames).toContain('find_tools');
  });

  it('Tier 2: Semantic Domain Expansion correctly resolves slang and non-exact synonyms', () => {
    // "почему прод пятисотит" -> no direct lexical match with "sentry" or "datadog",
    // but semantic cluster maps "пятисотит" -> logs, error, sentry, datadog
    const result = filterRelevantTools(allTools, 'Посмотри почему прод пятисотит и падают серверы', undefined, {
      maxDynamicTools: 2,
      minToolsThreshold: 8,
    });

    const resultNames = result.map((t) => t.name);
    expect(resultNames).toContain('sentry_get_issues');
    expect(resultNames).toContain('datadog_query_logs');
    expect(resultNames).not.toContain('s3_upload_file');
    expect(resultNames).not.toContain('slack_send_message');
  });

  it('Tier 3: Injects find_tools meta-tool for agentic on-demand discovery', () => {
    const result = filterRelevantTools(allTools, 'General investigation task', undefined, {
      maxDynamicTools: 2,
      minToolsThreshold: 8,
      includeMetaTool: true,
    });

    const resultNames = result.map((t) => t.name);
    expect(resultNames).toContain('find_tools');
    expect(result).toContainEqual(FIND_TOOLS_DECLARATION);
  });
});
