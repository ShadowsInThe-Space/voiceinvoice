import * as esbuild from 'esbuild';
import { join } from 'path';

async function build() {
  const isDev = process.env.NODE_ENV === 'development';

  const commonConfig = {
    bundle: true,
    platform: 'node',
    target: 'node20', // Electron 35 uses Node 20
    external: ['electron', '@prisma/client'],
    sourcemap: isDev,
    minify: !isDev,
    loader: {
      '.ts': 'ts',
    },
  };

  try {
    // Build Main Process
    await esbuild.build({
      ...commonConfig,
      entryPoints: ['electron/main.ts'],
      outfile: 'dist/electron/main.js',
    });

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
