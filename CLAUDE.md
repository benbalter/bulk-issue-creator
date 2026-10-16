# CLAUDE.md

Bulk issue (or comment) creator: a TypeScript CLI that also ships as a GitHub Action ([`action.yml`](action.yml) runs `dist/index.js`). Source is in [`src/`](src/), test fixtures in [`fixtures/`](fixtures/).

## Commands

- `script/cibuild` is what CI runs: lint (eslint + `prettier --check .`, which covers Markdown), tests, build, a CLI smoke test, then fails if `README.md` or `action.yml` differ from what the code generates. Run it before committing.
- `npm run all` does the same but rewrites files (`eslint --fix`, `prettier --write`) first.

## Generated files

- `dist/` is the ncc bundle the Action runs. It's gitignored and never committed to main: `npm run build` (or `npm ci`, via the `prepare` script) builds it locally, and [`script/release`](script/release) commits it only onto release tags. Keeping it off main means dependency bot PRs have no bundle to rebuild.
- The README options table (below `<!-- Options here -->`) and the `inputs` in `action.yml` are generated from the CLI's `--help` output by [`script/update-options`](script/update-options). Change the option in `src/`, run `npm run build && script/update-options`, and commit both files. Don't edit either by hand; `script/cibuild` fails when they drift.
- [`src/gitlab-openapi.ts`](src/gitlab-openapi.ts) holds the GitLab client's types, generated from GitLab's OpenAPI description by [`script/update-gitlab-types.mjs`](script/update-gitlab-types.mjs) (`npm run gitlab-types`). Change the pinned version or the operations in [`spec/gitlab/config.json`](spec/gitlab/config.json), and fix upstream spec bugs with overlays in [`spec/gitlab/overlays/`](spec/gitlab/overlays/). Don't edit the generated file by hand. It and the overlays are CC BY-SA 4.0, not MIT (see [`NOTICE`](NOTICE)).

## Releasing

Users pin the major tag (`benbalter/bulk-issue-creator@v2`), so moving that tag or publishing a release ships to every workflow that uses it. Releases are local and manual because the "Release tags" ruleset only lets the repo admin move `v*` tags:

1. On an up-to-date, clean main, run `script/release vX.Y.Z`. It builds `dist/`, commits it on a detached commit on top of main, tags that commit `vX.Y.Z`, and moves `vX` to it. It never changes main or pushes.
2. Push with the commands it prints (`git push origin vX.Y.Z` and `git push --force origin vX`), then optionally run the `gh release create` command it prints.

Run the script or push tags only after the owner's explicit go-ahead, and push branches with `--no-follow-tags`.

## Gotchas

- Every push to main runs [`integration.yml`](.github/workflows/integration.yml), which builds the pushed commit and runs it (`uses: ./bulk-issue-creator`) against a test repo, creating real issues there.
