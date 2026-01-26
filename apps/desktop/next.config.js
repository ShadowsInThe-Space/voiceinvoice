// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const nextConfig = {
  // Standalone output for Electron - creates minimal server with all dependencies
  output: 'standalone',
  distDir: '.next',
  // Limit file tracing to monorepo root (fixes Windows CI permission errors)
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    unoptimized: true,
  },
  eslint: {
    // Disable ESLint during build - we run it separately
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We run TypeScript separately in CI
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
