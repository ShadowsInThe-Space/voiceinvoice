// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const nextConfig = {
  // Standalone output for Electron - creates minimal server with all dependencies
  output: 'standalone',
  distDir: '.next',
  // Limit file tracing to monorepo root (fixes Windows CI permission errors)
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    // Exclude Windows system directories from file tracing
    outputFileTracingExcludes: {
      '*': [
        'C:\\Users\\*\\Application Data\\**',
        'C:\\Users\\*\\AppData\\**',
        'C:\\Windows\\**',
        'C:\\Program Files\\**',
        'C:\\Program Files (x86)\\**',
      ],
    },
  },
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
