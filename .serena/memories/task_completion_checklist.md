# Task Completion Checklist

Before finalizing any task, ensure the following steps are completed:

1. **Verify Implementation:**
   - Code adheres to the established style and conventions.
   - Public APIs are documented with JSDoc.
   - Changes are well-integrated and don't introduce regressions.

2. **Testing (TDD):**
   - New tests are written for the changes.
   - All tests pass (`pnpm test`).
   - Test coverage meets the 80% requirement (`pnpm test:coverage`).

3. **Validation:**
   - Run `pnpm run ci:validate` to ensure linting, typechecking, testing, and building all pass.

4. **Git Workflow:**
   - Commit message follows Conventional Commits.
   - Branch follows the `feature/subagent-XX-description` pattern.
