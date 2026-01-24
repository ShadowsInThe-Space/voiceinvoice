# Suggested Commands

## Development
- `pnpm dev`: Starts the development server for all apps.
- `pnpm build`: Builds all packages and apps.
- `pnpm lint`: Runs ESLint across the monorepo.
- `pnpm typecheck`: Runs TypeScript compiler checks.

## Testing
- `pnpm test`: Runs the test suite using Vitest.
- `pnpm test:coverage`: Runs tests and generates a coverage report.

## CI & Validation
- `pnpm run ci:validate`: Performs a full local CI validation (lint, typecheck, test, build). **MUST** be run before every commit.

## Documentation
- `pnpm run docs:generate`: Generates Doxygen API documentation.
- `pnpm run docs:serve`: Serves the generated documentation on http://localhost:8080.
