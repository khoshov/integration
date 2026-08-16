/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPlatformFolder() {
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

export function setupOfflineRtk() {
  const platformFolder = getPlatformFolder();
  if (!platformFolder) {
    console.warn(`[RTK] Unsupported platform (${process.platform}-${process.arch}) for pre-bundled RTK.`);
    return;
  }

  const binDir = path.resolve(__dirname, '..', 'bin');
  const vendorDir = path.join(binDir, 'vendor', platformFolder);
  const binaryName = process.platform === 'win32' ? 'rtk.exe' : 'rtk';
  const srcBinary = path.join(vendorDir, binaryName);
  const destBinary = path.join(binDir, binaryName);

  if (!fs.existsSync(srcBinary)) {
    console.warn(`[RTK] Vendor binary not found at ${srcBinary}.`);
    return;
  }

  try {
    fs.mkdirSync(binDir, { recursive: true });
    fs.copyFileSync(srcBinary, destBinary);
    if (process.platform !== 'win32') {
      fs.chmodSync(destBinary, 0o755);
    }
    console.log(`[RTK] Successfully installed offline RTK binary to ${destBinary}`);
  } catch (err) {
    console.warn(`[RTK] Failed to set up offline RTK binary:`, err);
  }
}

// Run if executed directly
if (process.argv[1] === __filename) {
  setupOfflineRtk();
}
