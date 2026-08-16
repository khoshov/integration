/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { filterRelevantTools, tokenizeText, scoreTool } from './tool-detox.js';

describe('Tool Detox', () => {
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
      name: 'github_create_pr',
      description: 'Open a pull request on GitHub repository',
      parametersJsonSchema: { properties: { title: { type: 'string' }, branch: { type: 'string' } } },
    },
    {
      name: 'github_list_issues',
      description: 'List open issues on GitHub repository',
    },
    {
      name: 'slack_send_message',
      description: 'Send a notification message to a Slack channel',
    },
    {
      name: 'slack_list_channels',
      description: 'List all available Slack channels in the workspace',
    },
    {
      name: 'playwright_navigate',
      description: 'Navigate browser to URL and take screenshot',
    },
    {
      name: 'playwright_click',
      description: 'Click an element on the webpage',
    },
    {
      name: 's3_upload_file',
      description: 'Upload an artifact to AWS S3 bucket',
    },
  ];

  const allTools = [...coreTools, ...mcpTools];

  it('preserves all tools if total count is <= minToolsThreshold', () => {
    const smallList = allTools.slice(0, 8);
    const result = filterRelevantTools(smallList, 'run tests', undefined, { minToolsThreshold: 10 });
    expect(result.length).toBe(smallList.length);
  });

  it('always retains core tools and selects database tools when query mentions database', () => {
    const result = filterRelevantTools(allTools, 'Query the database and check the users table', undefined, {
      maxDynamicTools: 3,
      minToolsThreshold: 10,
    });

    const resultNames = result.map((t) => t.name);

    // All core tools must be present
    expect(resultNames).toContain('shell');
    expect(resultNames).toContain('read_file');
    expect(resultNames).toContain('edit');

    // Postgres tools must be prioritized over Slack/S3/Playwright
    expect(resultNames).toContain('postgres_query');
    expect(resultNames).toContain('postgres_list_tables');
    expect(resultNames).not.toContain('slack_send_message');
    expect(resultNames).not.toContain('s3_upload_file');
  });

  it('boosts recently used tools from history', () => {
    const history = [
      {
        role: 'model',
        parts: [{ functionCall: { name: 'slack_send_message', args: {} } }],
      },
    ];

    const result = filterRelevantTools(allTools, 'check status', history as any, {
      maxDynamicTools: 2,
      minToolsThreshold: 10,
    });

    const resultNames = result.map((t) => t.name);
    expect(resultNames).toContain('slack_send_message');
  });
});
