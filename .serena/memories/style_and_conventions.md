# Style and Conventions

## Coding Style
- **TypeScript:** Strict typing preferred.
- **ESLint:** Follows `@typescript-eslint/recommended` and `jsdoc/recommended-typescript`.
- **Prettier:**
  - Semicolons: Yes (`semi: true`)
  - Quotes: Single (`singleQuote: true`)
  - Trailing Commas: ES5 (`trailingComma: "es5"`)
  - Indentation: 2 spaces
  - Print Width: 100
- **Documentation:** JSDoc is required for all public functions, methods, and classes.

## Git Conventions
- **Branching:** `feature/subagent-XX-description` (e.g., `feature/subagent-01-add-auth`).
- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat(scope): description`
  - `fix(scope): description`
  - `docs(scope): description`
  - `test(scope): description`
  - `refactor(scope): description`
  - `chore(scope): description`

## Testing (TDD)
- Follow the Red-Green-Refactor cycle.
- Coverage requirements: 80% for branches, functions, lines, and statements.
