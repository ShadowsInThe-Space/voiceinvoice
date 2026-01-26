/**
 * Prepares Next.js standalone output for Electron packaging.
 *
 * Copies static assets (public/, .next/static/) to the standalone directory
 * as required by Next.js standalone output mode.
 *
 * @see https://nextjs.org/docs/pages/api-reference/next-config-js/output
 */

import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const standaloneDir = join(process.cwd(), '.next', 'standalone');
const staticDir = join(process.cwd(), '.next', 'static');
const publicDir = join(process.cwd(), 'public');

// In a monorepo, the app directory structure is preserved
const standaloneAppDir = join(standaloneDir, 'apps', 'desktop');

console.log('Preparing standalone build...');

// Verify standalone directory exists
if (!existsSync(standaloneDir)) {
  console.error('Error: Standalone directory not found. Make sure next.config.js has output: "standalone"');
  process.exit(1);
}

// Copy public directory to standalone app directory (monorepo structure)
if (existsSync(publicDir)) {
  const destPublic = join(standaloneAppDir, 'public');
  console.log('Copying public/ to standalone/apps/desktop/...');
  cpSync(publicDir, destPublic, { recursive: true });
}

// Copy .next/static to standalone app directory (monorepo structure)
if (existsSync(staticDir)) {
  const destStatic = join(standaloneAppDir, '.next', 'static');
  console.log('Copying .next/static/ to standalone/apps/desktop/.next/...');
  mkdirSync(join(standaloneAppDir, '.next'), { recursive: true });
  cpSync(staticDir, destStatic, { recursive: true });
}

console.log('Standalone preparation complete.');
