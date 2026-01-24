const nextConfig = {
  output: 'export',
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
