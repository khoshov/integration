/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRtkExecutablePath,
  getRtkBinDir,
  augmentEnvWithRtk,
  rewriteCommandWithRtk,
  _resetRtkCache,
} from './rtk.js';

describe('RTK integration utils', () => {
  beforeEach(() => {
    _resetRtkCache();
  });

  it('locates the bundled RTK executable', () => {
    const rtkPath = getRtkExecutablePath();
    expect(rtkPath).not.toBeNull();
    expect(typeof rtkPath).toBe('string');
  });

  it('gets the bin directory for PATH augmentation', () => {
    const binDir = getRtkBinDir();
    expect(binDir).not.toBeNull();
    expect(typeof binDir).toBe('string');
  });

  it('augments environment PATH with rtk bin directory', () => {
    const originalEnv = { PATH: '/usr/bin:/bin' };
    const augmented = augmentEnvWithRtk(originalEnv);
    const binDir = getRtkBinDir();
    expect(augmented.PATH).toContain(binDir!);
  });

  it('rewrites commands like git status to rtk git status', () => {
    const rewritten = rewriteCommandWithRtk('git status');
    expect(rewritten).toBe('rtk git status');
  });

  it('rewrites commands like ls -la to rtk ls -la', () => {
    const rewritten = rewriteCommandWithRtk('ls -la');
    expect(rewritten).toBe('rtk ls -la');
  });

  it('leaves non-rewritable commands intact', () => {
    const cmd = 'echo "hello world"';
    const rewritten = rewriteCommandWithRtk(cmd);
    expect(rewritten).toBe(cmd);
  });
});
