# GitHub Actions workflows (templates)

These workflow files are kept here as templates because pushing files under
`.github/workflows/` requires a GitHub token with the `workflow` OAuth scope,
which the initial automated push did not have.

To enable CI and automated npm releases, copy them into place and push from a
session that has the `workflow` scope:

```bash
mkdir -p .github/workflows
cp docs/github-workflows/ci.yml .github/workflows/ci.yml
cp docs/github-workflows/release.yml .github/workflows/release.yml

# Authorize the workflow scope once (opens a browser):
gh auth refresh -h github.com -s workflow

git add .github/workflows
git commit -m "ci: add CI and release workflows"
git push
```

## ci.yml
Runs build + unit tests + end-to-end tests on Node 18/20/22 for every push and
pull request to `main`.

## release.yml
Publishes the package to npm when a `vX.Y.Z` tag is pushed. Requires an
`NPM_TOKEN` secret in the repository settings (Settings → Secrets and variables
→ Actions → New repository secret).
