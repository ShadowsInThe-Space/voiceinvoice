const nextConfig = {
  // Removed 'output: export' to enable API Routes for TTS
  // Electron runs Next.js in dev server mode, so we need server-side features
  distDir: '.next',
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
