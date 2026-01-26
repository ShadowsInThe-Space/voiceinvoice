const nextConfig = {
  // Standalone output for Electron - creates minimal server with all dependencies
  output: 'standalone',
  distDir: '.next',
  experimental: {
    // Exclude Windows system directories from file tracing (fixes EPERM errors on CI)
    outputFileTracingExcludes: {
      '*': [
        // Windows system directories
        'C:\\Windows\\**',
        'C:\\Program Files\\**',
        'C:\\Program Files (x86)\\**',
        'C:\\ProgramData\\**',
        // User directories that might have permission issues
        'C:\\Users\\*\\Application Data\\**',
        'C:\\Users\\*\\AppData\\**',
        'C:\\Users\\*\\Local Settings\\**',
        'C:\\Users\\*\\My Documents\\**',
        // System volume information
        'C:\\System Volume Information\\**',
        'C:\\$Recycle.Bin\\**',
        // Other common restricted paths
        'C:\\hiberfil.sys',
        'C:\\pagefile.sys',
        'C:\\swapfile.sys',
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
