/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

let cachedRtkPath: string | null | undefined = undefined;

function getPlatformFolder(): string | null {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') {
    return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (platform === 'linux') {
    return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  } else if (platform === 'win32') {
    return 'win32-x64';
  }
  return null;
}

/**
 * Locate the RTK executable path.
 */
export function getRtkExecutablePath(): string | null {
  if (cachedRtkPath !== undefined) {
    return cachedRtkPath;
  }

  const binaryName = process.platform === 'win32' ? 'rtk.exe' : 'rtk';

  // Candidate paths in order of preference
  const candidatePaths: string[] = [];

  try {
    const currentFile = fileURLToPath(import.meta.url);
    const coreDir = path.dirname(currentFile);
    // Relative from packages/core/src/utils/, packages/core/dist/, packages/cli/dist/, etc.
    candidatePaths.push(
      path.resolve(coreDir, '../../cli/bin', binaryName),
      path.resolve(coreDir, '../../../cli/bin', binaryName),
      path.resolve(coreDir, '../../packages/cli/bin', binaryName),
      path.resolve(coreDir, '../../../packages/cli/bin', binaryName),
      path.resolve(coreDir, '../bin', binaryName),
      path.resolve(coreDir, '../../bin', binaryName),
    );

    const platformFolder = getPlatformFolder();
    if (platformFolder) {
      candidatePaths.push(
        path.resolve(coreDir, '../../cli/bin/vendor', platformFolder, binaryName),
        path.resolve(coreDir, '../../../cli/bin/vendor', platformFolder, binaryName),
        path.resolve(coreDir, '../../packages/cli/bin/vendor', platformFolder, binaryName),
        path.resolve(coreDir, '../../../packages/cli/bin/vendor', platformFolder, binaryName),
        path.resolve(coreDir, '../bin/vendor', platformFolder, binaryName),
        path.resolve(coreDir, '../../bin/vendor', platformFolder, binaryName),
      );
    }
  } catch {
    // Ignore URL resolution errors
  }

  // Home directory ~/.qwen/bin/rtk
  const homeDir = process.env['HOME'] || process.env['USERPROFILE'];
  if (homeDir) {
    candidatePaths.push(path.join(homeDir, '.qwen', 'bin', binaryName));
  }

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(p, 0o755);
          } catch {
            // Ignore chmod errors if permissions already set
          }
        }
        cachedRtkPath = p;
        return p;
      }
    } catch {
      // Continue search
    }
  }

  // Check global PATH
  try {
    const checkCmd = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(checkCmd, ['rtk'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 500,
    }).trim();
    if (out && fs.existsSync(out.split('\n')[0].trim())) {
      cachedRtkPath = out.split('\n')[0].trim();
      return cachedRtkPath;
    }
  } catch {
    // Not found in PATH
  }

  cachedRtkPath = null;
  return null;
}

/**
 * Returns the directory containing the RTK executable so it can be added to PATH.
 */
export function getRtkBinDir(): string | null {
  const exePath = getRtkExecutablePath();
  return exePath ? path.dirname(exePath) : null;
}

/**
 * Augments the environment PATH with the RTK directory so commands like `rtk ...` work.
 */
export function augmentEnvWithRtk(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const binDir = getRtkBinDir();
  if (!binDir) {
    return env;
  }

  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  const currentPath = env[pathKey] || '';
  const pathSep = process.platform === 'win32' ? ';' : ':';

  if (!currentPath.split(pathSep).includes(binDir)) {
    return {
      ...env,
      [pathKey]: `${binDir}${pathSep}${currentPath}`,
    };
  }

  return env;
}

/**
 * Rewrites a shell command using RTK if available and beneficial.
 * Safe fallback: returns original command on any error or timeout.
 */
export function rewriteCommandWithRtk(command: string): string {
  const rtkPath = getRtkExecutablePath();
  if (!rtkPath) {
    return command;
  }

  try {
    const output = execFileSync(rtkPath, ['rewrite', command], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    }).trim();

    if (output && (output.startsWith('rtk ') || output.startsWith('rtk.exe '))) {
      return output;
    }
  } catch (err: unknown) {
    // rtk rewrite exits with code 3 on successful rewrite
    const nodeErr = err as { status?: number; stdout?: string | Buffer };
    if (nodeErr && (nodeErr.status === 3 || nodeErr.status === 0) && nodeErr.stdout) {
      const outStr = nodeErr.stdout.toString().trim();
      if (outStr && (outStr.startsWith('rtk ') || outStr.startsWith('rtk.exe '))) {
        return outStr;
      }
    }
  }

  return command;
}

/**
 * Reset cache for tests.
 */
export function _resetRtkCache(): void {
  cachedRtkPath = undefined;
}
