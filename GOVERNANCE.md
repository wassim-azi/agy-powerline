# Governance

agy-powerline is a single-maintainer open source project under the [MIT license](LICENSE). This page says who decides what, and how the project keeps going if the maintainer can't.

## Roles

| Role        | Who                                                                                   | Responsibilities                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Maintainer  | [@wassim-azi](https://github.com/wassim-azi)                                          | Reviews and merges pull requests, triages issues, handles vulnerability reports ([SECURITY.md](SECURITY.md)), cuts releases, keeps `main`, the npm package and the site. |
| Contributor | Anyone who opens an issue, a discussion or a pull request                             | Follows [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).                                                                                |
| Translator  | A native or fluent speaker who adds or updates a language of the bar or of the README | Reviews every line of the translation and says so in the pull request.                                                                                                   |

`.github/CODEOWNERS` requests the maintainer's review on every pull request.

## How decisions are made

- Every change, the maintainer's included, goes through a pull request with the required CI checks; nobody pushes to `main` directly.
- Bugs, features and changes start as [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues); open questions and ideas go to [Discussions](https://github.com/wassim-azi/agy-powerline/discussions). Anyone can comment.
- The maintainer makes the final decision, explains it in the issue or pull request, and records user-visible changes in [CHANGELOG.md](CHANGELOG.md).
- Rules that protect users' machines (no runtime dependencies, no network calls, no shell, never lose user settings) are listed in [AGENTS.md](AGENTS.md#hard-rules) and are not relaxed for a feature.
- Planned work is in [ROADMAP.md](ROADMAP.md).

## Releases

Only the maintainer releases. A release is tagged on `main` and published by `.github/workflows/release.yml`, which needs the maintainer's approval in the protected `npm-publish` environment. See [CONTRIBUTING.md](CONTRIBUTING.md#-branches) for the branch model.

## Continuity

The project can continue if the maintainer is no longer able to work on it:

- The maintainer's GitHub account has a successor, who gets admin access to the repository and can then triage issues, merge pull requests and run releases.
- npm publishing uses trusted publishing from this repository's release workflow, so no personal npm token is needed to release: whoever administers the repository can approve the `npm-publish` environment and publish.
- Everything needed to build, test and release is in this repository, and the MIT license lets anyone fork it.
