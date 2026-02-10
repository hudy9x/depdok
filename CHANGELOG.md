## What's Changed

✨ Features

- Find in files (#17) ([7264d2b](../../commit/7264d2b))

🐛 Bug Fixes

- Quote `echo` command in `on-release.yml` workflow. ([4149415](../../commit/4149415))

♻️ Refactoring

- Replace `workflow_run`-triggered public repository publishing with a `release`-triggered placeholder workflow. ([8da91fd](../../commit/8da91fd))

🔨 Other Changes

- Update default public_repo to 'hudy9x/depdok-ladi'. ([353367d](../../commit/353367d))
- Implement workflow to download latest release assets and create a new release in a specified public repository. ([98a9c00](../../commit/98a9c00))
- Change workflow trigger from `repository_dispatch` to `workflow_dispatch`. ([4b2a9b9](../../commit/4b2a9b9))
- Add GitHub Actions workflow to fetch the latest release tag. ([cd7aedc](../../commit/cd7aedc))
- Trigger release workflow on edited releases. ([96d5e61](../../commit/96d5e61))
- Update release workflow trigger types from `released` to `created`. ([b98bb88](../../commit/b98bb88))
- Add `released` as a trigger type for the `on-release` workflow. ([8cb4750](../../commit/8cb4750))
- Remove redundant comment from release workflow trigger. ([35f2af2](../../commit/35f2af2))
- Version upgrade ([e2d1be4](../../commit/e2d1be4))


📋 Full Changelog: [e2d1be4...7264d2b](../../compare/e2d1be4...7264d2b)