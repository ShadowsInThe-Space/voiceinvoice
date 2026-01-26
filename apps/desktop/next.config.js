// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const nextConfig = {
  // Standalone output for Electron - creates minimal server with all dependencies
  output: 'standalone',
  distDir: '.next',

  // Configure webpack to ignore Windows system directories during build
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  webpack: (config, { isServer }) => {
    if (isServer && process.platform === 'win32') {
      // Ignore Windows system directories to prevent EPERM errors
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          // Windows system directories
          'C:/Windows/**',
          'C:/Program Files/**',
          'C:/Program Files (x86)/**',
          'C:/ProgramData/**',
          // User directories
          'C:/Users/*/Application Data/**',
          'C:/Users/*/AppData/**',
          'C:/Users/*/Local Settings/**',
          'C:/Users/*/My Documents/**',
          // System files
          'C:/System Volume Information/**',
          'C:/$Recycle.Bin/**',
        ],
      };
    }
    return config;
  },

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
    // Limit turbotrace to workspace only
    turbotrace: {
      contextDirectory: path.join(__dirname, '../..'),
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
