# Contributing

Thank you for your interest in contributing to RepoProof! We welcome contributions of all kinds: bug reports, feature requests, documentation improvements, and code changes.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/repoproof.git
   cd repoproof
   ```
3. **Install dependencies:**
   ```bash
   pnpm install
   ```
4. **Verify everything works:**
   ```bash
   pnpm verify
   ```

## Development

| Command              | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `pnpm build`         | Build the project                                              |
| `pnpm dev`           | Watch mode with auto-rebuild                                   |
| `pnpm test`          | Run tests                                                      |
| `pnpm test:watch`    | Run tests in watch mode                                        |
| `pnpm test:coverage` | Run tests with coverage report                                 |
| `pnpm lint`          | Lint source files                                              |
| `pnpm format`        | Format source files                                            |
| `pnpm format:check`  | Check formatting                                               |
| `pnpm typecheck`     | Run TypeScript type checking                                   |
| `pnpm smoke`         | Run smoke tests against fixtures                               |
| `pnpm verify`        | Run typecheck, lint, format check, test, build, and smoke test |

## Project Structure

```
src/
├── cli/            # CLI entry point (commander-based)
├── config/         # Configuration loading and validation
├── engine/         # Scanner, rule runner, and scoring
├── reporters/      # Output formatters (text, json, html, markdown, sarif)
├── rules/          # Rule implementations (one file per rule)
└── types.ts        # Shared TypeScript types and interfaces
```

## Adding a Rule

1. Create a new file in `src/rules/` following the existing pattern.
2. Export a `rule` constant that conforms to the `Rule` interface.
3. Import and add it to the `rules` array in `src/rules/index.ts`.
4. Add tests in `src/rules/__tests__/`.
5. Document the rule in `docs/rules.md`.

## Code Style

- **TypeScript** — strict mode, no `any` unless absolutely necessary
- **No commented code** — remove it instead
- **No TODO/FIXME markers** — fix or track in issues
- **ESM** — use `import`/`export` with `.js` extensions
- **No external dependencies** beyond `commander` and `strip-ansi`

## Testing

- Tests use **Vitest** and are colocated in `__tests__` directories.
- Each rule should have tests for positive cases (triggers correctly) and negative cases (no false positives).
- Run `pnpm test` before submitting.

## Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes, adding tests and documentation.
3. Run `pnpm verify` locally to ensure all checks pass.
4. Open a pull request with a clear description of the change.
5. Ensure the PR description explains what problem it solves and how.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold its standards.

## Questions?

Open an issue or start a discussion on GitHub. We're happy to help!
