# CLAUDE.md

Bulk issue (or comment) creator: a TypeScript CLI that also ships as a GitHub Action ([`action.yml`](action.yml) runs [`dist/index.js`](dist/index.js)). Source is in [`src/`](src/), test fixtures in [`fixtures/`](fixtures/).

## Commands

- `script/cibuild` is what CI runs: lint (eslint + `prettier --check .`, which covers Markdown), tests, build, a CLI smoke test, then fails if `dist/`, `README.md`, or `action.yml` differ from what the code generates. Run it before committing.
- `npm run all` does the same but rewrites files (`eslint --fix`, `prettier --write`) first.

## Generated files

- `dist/` is the ncc bundle the Action runs. Rebuild with `npm run build` and commit it with any change to `src/` or dependencies, or CI fails. For Renovate and Dependabot PRs, [`rebuild-dist.yml`](.github/workflows/rebuild-dist.yml) commits it for you.
- The README options table (below `<!-- Options here -->`) and the `inputs` in `action.yml` are generated from the CLI's `--help` output by [`script/update-options`](script/update-options). Change the option in `src/`, run `npm run build && script/update-options`, and commit both files. Don't edit either by hand; `script/cibuild` fails when they drift.

## Releasing

Users pin the major tag (`benbalter/bulk-issue-creator@v2`), so moving that tag or publishing a release ships to every workflow that uses it. Prepare a release PR if asked, but tag or publish only after the owner's explicit go-ahead, and push branches with `--no-follow-tags`.

## Gotchas

- Every push to main runs [`integration.yml`](.github/workflows/integration.yml), which uses `@main` against a test repo and creates real issues there.
