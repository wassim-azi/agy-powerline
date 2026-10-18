# agy-powerline

**English** | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [Français](README.fr.md)

[![CI](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml)
[![Version](https://img.shields.io/npm/v/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Downloads](https://img.shields.io/npm/dt/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Node](https://img.shields.io/badge/node-%3E%3D20-informational.svg)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational.svg)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#privacy-and-security)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/wassim-azi/agy-powerline/badge)](https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline)
[![Mentioned in Awesome Gemini CLI](https://img.shields.io/badge/mentioned%20in-awesome-fc60a8.svg?logo=awesomelists&logoColor=white)](https://github.com/Piebald-AI/awesome-gemini-cli)

**A fast, configurable statusline for Google Antigravity's CLI (`agy`).**

See your model, Gemini 5h/7d, Claude/GPT and Argon quotas, context window, git branch and more at a glance. Pick widgets, themes and layout from an interactive editor. One command to install, no dependencies.

<p align="center">
  <img src="assets/screenshots/pills-dark.png" alt="agy-powerline Pills layout with the dark-ocean theme: agent state, model, plan, project and git; context; 5h and 7d quotas with resets" width="850">
</p>

## Install

You need [Node.js](https://nodejs.org/) 20+ and the [Antigravity CLI](https://antigravity.google/docs/cli/overview). Works on Windows, macOS, Linux and WSL ([WSL notes](docs/install.md#wsl)).

```bash
npx agy-powerline init        # install the statusline into agy
npx agy-powerline configure   # optional: pick widgets, theme and layout
agy                           # start Antigravity
```

`init` asks before replacing anything and backs up Antigravity's `settings.json` first. Restart `agy` once after `init`. Details: [what `init` does](docs/install.md).

Or let agy install it: paste this into an `agy` session.

```text
Install the agy-powerline statusline: run `npx agy-powerline init --yes`, then tell me to restart agy.
```

`--yes` skips the prompts, which agy can't answer, and replaces any existing `statusLine` after backing up `settings.json`.

For a Nerd Font–free terminal, turn on ASCII mode (`i` in `configure`).

## Customize

`npx agy-powerline configure` opens an editor with a live preview of your bar. Use `←` `→` to switch between Widgets, Presets, Themes, Layout and Powerline, `↑` `↓` to move, Enter to pick, `q` to save and quit. The keys for each screen are shown at the bottom; the full list is in [Configuration](docs/configuration.md#configurator-keys).

Changes apply to a running `agy` on its next refresh.

### Presets

Start from a preset, then adjust:

| Preset      | Shows                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| `default`   | Model, context, git; 5h and 7d quotas with resets on a second row            |
| `compact`   | One line: short model, tightest quota, context %, git                        |
| `workspace` | Project, git, agent state, model; context, tightest quota and mode           |
| `limits`    | Every quota (5h, 7d, third-party, Argon), one per row                        |
| `full`      | Everything: session, project and git; context, tokens and cache; both quotas |

### Themes

| Terminal background | Themes                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dark                | `dark-aurora` (default), `dark-ocean`, `dark-ember`, `dark-forest`, `dark-neon`, `dark-mono`, `dark-nocturne`, `dark-onyx`, `dark-metro`, `dark-macchiato` |
| Light               | `light-paper`, `light-sky`, `light-sunset`, `light-cream`                                                                                                  |
| Color-blind safe    | `colorblind-dark`, `colorblind-light`                                                                                                                      |
| Your own colors     | `custom` ([how](docs/configuration.md#custom-theme))                                                                                                       |

Preview them all with `npx agy-powerline theme --gallery`. For one color sweep across each row, add a gradient: `npx agy-powerline gradient <name>` with `aurora`, `sunset`, `ocean`, `forest`, `neon`, `candy`, `rainbow`, `mono` or your own colors ([how](docs/configuration.md#gradients)).

### Layouts

**Pills** (default): powerline-style capsules. Choose round, angled, slanted or flat shapes, and optionally a blank line between rows.

<p align="center">
  <img src="assets/screenshots/pills-light.png" alt="agy-powerline Pills layout with the light-sky theme on a light terminal, with space between rows" width="850">
</p>

**Lines**: the same information as plain colored text.

<p align="center">
  <img src="assets/screenshots/lines-dark.png" alt="agy-powerline Lines layout with the dark-ocean theme on a dark terminal" width="850">
  <img src="assets/screenshots/lines-light.png" alt="agy-powerline Lines layout with the light-sky theme on a light terminal" width="850">
</p>

## Widgets

| Widget                                                        | Shows                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `model`                                                       | The model in use                                                                                         |
| `fiveHourBar`, `weeklyBar`                                    | 5h / 7d quota left as a meter, with a [pace marker](docs/configuration.md#quota-pace-marker)             |
| `fiveHourPct`, `weeklyPct`                                    | 5h / 7d quota left as a percentage                                                                       |
| `fiveHourReset`, `weeklyReset`                                | Time until the quota resets, or the reset time                                                           |
| `quota`                                                       | The quota closest to running out, with its reset                                                         |
| `thirdPartyFiveHour`, `thirdPartyWeekly`                      | Third-party model quotas                                                                                 |
| `argonWeekly`, `argonReset`                                   | Gemini 4 Argon's own weekly quota (Google AI Pro) and its reset                                          |
| `context`, `contextPct`, `contextTokens`                      | Context window used: meter, percentage or token counts                                                   |
| `git`                                                         | Branch, uncommitted changes and ahead/behind                                                             |
| `gitChanges`, `gitFiles`, `gitSha`, `gitStash`, `gitWorktree` | Lines added and removed, staged/modified/untracked/conflicted files, commit ID, stashes, linked worktree |
| `project`, `cwd`                                              | Project folder, current folder                                                                           |
| `agentState`, `plan`, `sandbox`, `artifacts`, `version`       | What the agent is doing, your plan, sandbox, artifacts, CLI version                                      |
| `tasks`                                                       | Running subagents and background tasks                                                                   |
| `mode`                                                        | Approval mode (e.g. accept-edits) and Vim mode                                                           |
| `title`                                                       | The conversation's title                                                                                 |
| `totalTokens`, `cacheHit`, `cacheRead`, `cacheCreate`         | Session tokens and prompt cache usage                                                                    |
| `tokensToday`, `tokensWeek`                                   | Tokens used today and over the last 7 days, all conversations (Node 22.13+)                              |
| `ram`                                                         | Memory used on your machine                                                                              |
| `customText`, `exec`                                          | Your own text, or the output of a [shell command](docs/configuration.md#shell-command-widget-exec)       |

A widget with nothing to show hides itself. Widgets can be recolored, made label-free or given their own alert thresholds: see [Configuration](docs/configuration.md).

## Commands

| Command                                   | What it does                                                |
| ----------------------------------------- | ----------------------------------------------------------- |
| `npx agy-powerline init [--yes]`          | Install or update the statusline                            |
| `npx agy-powerline configure`             | Open the editor (alias `config`)                            |
| `npx agy-powerline preset <name>`         | Apply a preset (`--list` to see them)                       |
| `npx agy-powerline theme <name>`          | Switch theme (`--list`, `--gallery`)                        |
| `npx agy-powerline gradient <name>`       | Color each row with a gradient (`--list`, `off`)            |
| `npx agy-powerline layout <pills\|lines>` | Switch layout                                               |
| `npx agy-powerline caps <style>`          | Switch the pill shape: `round`, `angled`, `slanted`, `flat` |
| `npx agy-powerline export [file]`         | Save your config to a file, to back it up or share it       |
| `npx agy-powerline import <file>`         | Load a config, after showing what changes (`--merge`)       |
| `npx agy-powerline doctor`                | Check the install and explain what's wrong                  |
| `npx agy-powerline report`                | Write a privacy-safe bug report                             |
| `npx agy-powerline uninstall [--delete]`  | Remove it from agy (`--delete` also removes its files)      |
| `npx agy-powerline render --demo`         | Print the bar with sample data                              |

Run any command with `--help` for its options.

## Updating

```bash
npx agy-powerline init --yes   # install the new version's scripts
npx agy-powerline doctor       # check everything is up to date
```

Your settings are kept. Restart `agy` afterwards.

## Troubleshooting

Run `npx agy-powerline doctor` first: it checks the install and tells you how to fix what it finds. Common problems and how to report a bug: [Troubleshooting](docs/troubleshooting.md).

## Privacy and security

- **No network calls, no telemetry.** Everything comes from the data agy passes to the bar, from `.git` and from your OS. The only link out is `g` in `configure`, which opens the GitHub page in your browser.
- **Your settings are safe.** `init` and `uninstall` back up `settings.json` and refuse to edit a file they can't parse.
- **Nothing runs unless you add it.** Apart from quick `git` calls for ahead/behind counts and for the file and line counts of the git widgets you add, the only commands the bar runs are `exec` widgets you configure yourself.
- **Zero runtime dependencies**, published from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements).

Full details: [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) (setup, architecture, adding a widget or theme) and the [Code of Conduct](CODE_OF_CONDUCT.md). Open pull requests against `develop`. Report bugs in [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues) or share ideas and feedback in [Discussions](https://github.com/wassim-azi/agy-powerline/discussions).

Thanks to everyone who has contributed:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yatharth2soni"><img src="https://avatars.githubusercontent.com/u/238868599?v=4&s=160" width="80" height="80" alt="Yatharth Soni"/><br /><sub><b>Yatharth Soni</b></sub></a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dannyward630"><img src="https://avatars.githubusercontent.com/u/71604164?v=4&s=160" width="80" height="80" alt="Danny Ward"/><br /><sub><b>Danny Ward</b></sub></a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yoreva-01"><img src="https://avatars.githubusercontent.com/u/195282707?v=4&s=160" width="80" height="80" alt="Yusuf Orçan"/><br /><sub><b>Yusuf Orçan</b></sub></a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yuefdev"><img src="https://avatars.githubusercontent.com/u/120668197?v=4&s=160" width="80" height="80" alt="Yusuf Efe"/><br /><sub><b>Yusuf Efe</b></sub></a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/hiyouwhatsapp"><img src="https://avatars.githubusercontent.com/u/89997383?v=4&s=160" width="80" height="80" alt="hiyouwhatsapp"/><br /><sub><b>hiyouwhatsapp</b></sub></a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dharamdan01"><img src="https://avatars.githubusercontent.com/u/188893946?v=4&s=160" width="80" height="80" alt="dharamdan01"/><br /><sub><b>dharamdan01</b></sub></a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

If agy-powerline is useful to you, a ⭐ helps other agy users find it.

## License

[MIT](LICENSE) © Wassim AZI
