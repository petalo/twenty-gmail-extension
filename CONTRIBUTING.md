# Contributing

Thanks for your interest in contributing to Twenty for Gmail!
This document covers the development workflow and guidelines.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- Node.js 18+
- A Google account with access to [Apps Script](https://script.google.com)
- A [Twenty CRM](https://twenty.com) workspace with an API token for testing

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies:

   ```bash
   npm install
   ```

   This also sets up the Husky pre-commit hook automatically.

3. Follow [INSTALL.md](INSTALL.md) to set up a test deployment in Gmail.

## Code style

This project uses [Biome](https://biomejs.dev) for linting and formatting.
The pre-commit hook runs Biome automatically on staged files,
but you can also run it manually:

```bash
npm run lint          # check for errors
npm run lint:fix      # auto-fix errors
npm run format        # format all source files
```

Key conventions:

- Double quotes, semicolons, no trailing commas.
- 2-space indentation.
- JSDoc on all public functions (`@description`, `@param`, `@returns`).
- Plain JSDoc types (`{string}`, `{Object}`, `{Array<Object>}`) — not GoogleAppsScript namespace types.

## Project structure

All source code lives in `src/apps_script/`. There is no bundler or
transpiler — files are pushed directly to Google Apps Script via
[clasp](https://github.com/google/clasp).

Since Apps Script uses a flat global scope (no modules), all functions
are globally available across files. This means:

- No `import`/`export` statements.
- Cross-file function calls work without any module wiring.
- Biome's `noUndeclaredVariables` rule is disabled for this reason.

## Testing

This project uses a mixed test strategy:

1. Automated local checks:
   - `npm run test` (runs lint + unit tests under `tests/*.test.js`)
2. Manual Gmail validation:
   - required for end-to-end add-on behavior in real Gmail sidebar runtime.

Recommended flow:

1. Run automated checks: `npm run test`
2. Push your changes: `npm run gas:push`
3. Open Gmail and verify the sidebar works correctly.
4. Refer to `docs/runbooks/03-qa-manual.md` for test scenarios.

## Submitting changes

1. Create a feature branch from `main`.
2. Make your changes — keep each PR focused on one feature or fix.
3. Ensure `npm run lint` passes (CI will also check this).
4. Test manually via a Gmail test deployment.
5. Open a pull request with a clear description of what changed and why.

## Security

- Never commit `src/apps_script/.clasp.json` (it contains your script ID).
- Never commit API tokens or secrets.
- Rotate test tokens after manual integration sessions.
- Follow [SECURITY.md](SECURITY.md) for responsible vulnerability disclosure.
