import * as esbuild from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  const isDev = process.env.NODE_ENV === 'development';

  // Resolve workspace packages to their actual paths
  const workspacePackages = [
    '@voiceinvoice/shared-types',
    '@voiceinvoice/database',
    '@voiceinvoice/privacy-engine',
    '@voiceinvoice/ai-orchestrator',
  ];

  const commonConfig = {
    bundle: true,
    platform: 'node',
    target: 'node20', // Electron 35 uses Node 20
    external: [
      'electron',
      // Native modules that can't be bundled
      '@google-cloud/speech',
      '@google-cloud/text-to-speech',
      '@prisma/client',
      'prisma',
    ],
    sourcemap: isDev,
    minify: !isDev,
    loader: {
      '.ts': 'ts',
    },
    // Enable Node.js module resolution
    resolveExtensions: ['.ts', '.js', '.mjs', '.json'],
    // Use Node resolution algorithm
    packages: 'bundle',
    // Ensure proper resolution of workspace packages
    alias: {
      '@voiceinvoice/shared-types': join(__dirname, '../../..', 'packages/shared-types/dist/index.js'),
    },
    logLevel: 'info',
  };

  try {
    console.log('Building Electron main process...');

    // Build Main Process
    const mainResult = await esbuild.build({
      ...commonConfig,
      entryPoints: ['electron/main.ts'],
      outfile: 'dist/electron/main.js',
      metafile: true,
    });

    // Log bundled files for debugging
    const bundledModules = Object.keys(mainResult.metafile?.inputs || {});
    console.log(`Bundled ${bundledModules.length} modules into main.js`);

    console.log('Building Electron preload...');

    // Build Preload
    await esbuild.build({
      ...commonConfig,
      entryPoints: ['electron/preload.ts'],
      outfile: 'dist/electron/preload.js',
    });

    console.log('Electron build completed successfully.');
  } catch (error) {
    console.error('Electron build failed:', error);
    process.exit(1);
  }
}

build();
