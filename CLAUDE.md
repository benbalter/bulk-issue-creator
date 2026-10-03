# CLAUDE.md

Bulk issue (or comment) creator: a TypeScript CLI that also ships as a GitHub Action ([`action.yml`](action.yml) runs [`dist/index.js`](dist/index.js)). Source is in [`src/`](src/), test fixtures in [`fixtures/`](fixtures/).

## Commands

- `script/cibuild` is what CI runs: lint (eslint + `prettier --check .`, which covers Markdown), tests, build, a CLI smoke test, then `git diff --exit-code dist/`. Run it before committing.
- `npm run all` does the same but rewrites files (`eslint --fix`, `prettier --write`) first.

## Generated files

- `dist/` is the ncc bundle the Action runs. Rebuild with `npm run build` and commit it with any change to `src/` or dependencies, or CI fails. For Renovate and Dependabot PRs, [`rebuild-dist.yml`](.github/workflows/rebuild-dist.yml) commits it for you.
- The README options table (below `<!-- Options here -->`) and the `inputs` in `action.yml` are generated from the CLI's `--help` output by [`script/update-options`](script/update-options). Change the option in `src/`, rebuild, then regenerate both rather than editing one by hand. On main the generator is broken (it needs `markdown-table` and drops bare flags like `--write`); [#100](https://github.com/benbalter/bulk-issue-creator/pull/100) fixes it, so until that merges, update both files by hand and keep them matching.

## Releasing

Users pin the major tag (`benbalter/bulk-issue-creator@v2`), so moving that tag or publishing a release ships to every workflow that uses it. Prepare a release PR if asked, but tag or publish only after the owner's explicit go-ahead, and push branches with `--no-follow-tags`.

## Gotchas

- Every push to main runs [`integration.yml`](.github/workflows/integration.yml), which uses `@main` against a test repo and creates real issues there.
