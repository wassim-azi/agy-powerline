# About agy-powerline

agy-powerline is a free, open-source status line for Google Antigravity CLI (`agy`). It shows the model, your quotas and how fast you're using them, the context window, git and more in agy's status bar, and lets you pick widgets, themes and layouts from an editor or from this site.

## Who makes it

agy-powerline is built and maintained by [Wassim AZI](https://github.com/wassim-azi), with help from the contributors below. It started as a way to keep an eye on Antigravity's 5-hour and weekly quotas without leaving the terminal, and grew into a status line with its own themes, layouts and configurator.

Questions, bugs and ideas go to [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues); there is no email address or support form.

## Principles

- **No runtime dependencies.** The package uses only Node.js built-ins, so installing it pulls in nothing else.
- **No network, no telemetry in the tool.** The status line and the CLI make no network requests and have no analytics. Only this website uses Google Analytics, to count visits ([Privacy](privacy.md)).
- **Your machine stays yours.** The config is read only from your own install folder, shell command widgets never run in previews, and `init` backs up agy's settings before changing them ([Security](../../../SECURITY.md)).
- **Every preview is real.** The bars on this site are rendered by the same code that draws your bar in agy.
- **Accessible by default.** Every theme is checked for WCAG AA contrast, and two themes are built for color-blind users.
- **MIT licensed.** Use it, change it and share it.

## Contributors

CONTRIBUTORS_LIST

Want to help? Read [CONTRIBUTING.md](https://github.com/wassim-azi/agy-powerline/blob/main/CONTRIBUTING.md) and pick an issue.

## Links

- Source code: [github.com/wassim-azi/agy-powerline](https://github.com/wassim-azi/agy-powerline)
- Package: [npmjs.com/package/agy-powerline](https://www.npmjs.com/package/agy-powerline)
- Release notes: [Changelog](../../../CHANGELOG.md)
