# agy-powerline

**English** | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [Français](README.fr.md)

[![Version](https://img.shields.io/npm/v/agy-powerline.svg)](https://www.npmjs.com/package/agy-powerline)
[![Downloads](https://img.shields.io/npm/d18m/agy-powerline.svg?cacheSeconds=86400)](https://www.npmjs.com/package/agy-powerline)
[![Stars](https://img.shields.io/github/stars/wassim-azi/agy-powerline?style=flat&color=gold&cacheSeconds=86400)](https://github.com/wassim-azi/agy-powerline/stargazers)
[![CI](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/ci.yml)
[![CodeQL](https://github.com/wassim-azi/agy-powerline/actions/workflows/codeql.yml/badge.svg)](https://github.com/wassim-azi/agy-powerline/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/wassim-azi/agy-powerline/badge)](https://scorecard.dev/viewer/?uri=github.com/wassim-azi/agy-powerline)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15655/badge)](https://www.bestpractices.dev/projects/15655)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#privacy-and-security)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0078D6.svg)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open in GitHub Codespaces](https://img.shields.io/badge/open%20in-Codespaces-24292f.svg?logo=github&logoColor=white)](https://codespaces.new/wassim-azi/agy-powerline?quickstart=1)
[![Web Configurator](https://img.shields.io/badge/web%20configurator-live-00dc82.svg)](https://agy-powerline.com/configure/)
[![Mentioned in Awesome Gemini CLI](https://img.shields.io/badge/mentioned%20in-awesome-fc60a8.svg?logo=awesomelists&logoColor=white)](https://github.com/Piebald-AI/awesome-gemini-cli)

**A fast, configurable statusline for Google Antigravity's CLI (`agy`).**

See your model, Gemini 5h/7d, Claude/GPT and Argon quotas, context window, git branch and more at a glance. Pick widgets, themes and layout from an interactive editor. One command to install, no dependencies.

<p align="center">
  <img src="assets/demo.gif" alt="agy-powerline configure: add Argon's weekly quota by typing argon, then browse the presets, themes and layouts with a live preview of the bar, and open the Powerline tab" width="850">
</p>

## Install

You need [Node.js](https://nodejs.org/) 20+ and the [Antigravity CLI](https://antigravity.google/docs/cli/overview). Works on Windows, macOS, Linux and WSL ([WSL notes](docs/install.md#wsl)).

```bash
npx agy-powerline init        # install the statusline into agy
npx agy-powerline configure   # optional: pick widgets, theme and layout
agy                           # start Antigravity
```

On a first install `init` asks for a preset, a layout and a theme, with a preview of each; add `--yes` to skip the questions. It asks before replacing anything and backs up Antigravity's `settings.json` first. Restart `agy` once after `init`. Details: [what `init` does](docs/install.md).

<details>
<summary>Screenshot: the bar in a real agy session (Windows Terminal)</summary>

<p align="center">
  <img src="assets/screenshots/windows.png" alt="agy-powerline under agy's input box in Windows Terminal: a short conversation above, the three-row Pills bar below" width="850">
</p>

</details>

### Install from inside agy

agy-powerline is also an agy plugin. Add it, then run its setup skill in an `agy` session; it runs `init` and `doctor` for you:

```text
agy plugin install https://github.com/wassim-azi/agy-powerline
/agy-powerline-setup
```

Restart `agy` once afterwards. Details: [the plugin route](docs/install.md#install-from-inside-agy-plugin).

Or paste this into an `agy` session.

```text
Install the agy-powerline statusline: run `npx agy-powerline init --yes`, then tell me to restart agy.
```

`--yes` skips the prompts, which agy can't answer, and replaces any existing `statusLine` after backing up `settings.json`.

For a Nerd Font–free terminal, turn on ASCII mode (`i` in `configure`).

## Customize

`npx agy-powerline configure` opens an editor with a live preview of your bar. Use `←` `→` to switch between Widgets, Presets, Themes, Layout and Powerline, `↑` `↓` to move, Enter to pick, `q` to save and quit. The keys for each screen are shown at the bottom; the full list is in [Configuration](docs/configuration.md#configurator-keys).

Prefer a browser? [Build your bar in the browser](https://agy-powerline.com/configure/) with live previews, then download or import it.

Changes apply to a running `agy` on its next refresh.

### Presets

Start from a preset, then adjust:

| Preset    | Shows                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| `default` | Model, context, git; 5h and 7d quotas with resets on a second row                         |
| `compact` | One line: short model, tightest quota, context %, git                                     |
| `agent`   | Agent state, subagents, title, mode, sandbox; model, context %, artifacts, tightest quota |
| `git`     | Project, branch, worktree, stash; file counts, line changes, commit                       |
| `tokens`  | Context tokens, session tokens in/out, cache hit; tokens today and over 7 days            |
| `quotas`  | Plan and model; 5h and 7d quotas side by side; third-party and Argon on a third row       |
| `full`    | Everything: session, project and git; context, tokens and cache; both quotas              |

### Themes

| Terminal background | Themes                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dark                | `dark-aurora` (default), `dark-ocean`, `dark-ember`, `dark-forest`, `dark-neon`, `dark-mono`, `dark-nocturne`, `dark-onyx`, `dark-metro`, `dark-macchiato` |
| Light               | `light-paper`, `light-sky`, `light-sunset`, `light-cream`                                                                                                  |
| Color-blind safe    | `colorblind-dark`, `colorblind-light`                                                                                                                      |
| Your own colors     | `custom` ([how](docs/configuration.md#custom-theme))                                                                                                       |

Preview them all in the [theme gallery](https://agy-powerline.com/) or with `npx agy-powerline theme --gallery`. For one color sweep across each row, add a gradient: `npx agy-powerline gradient <name>` with `aurora`, `sunset`, `ocean`, `forest`, `neon`, `candy`, `rainbow`, `mono` or your own colors ([how](docs/configuration.md#gradients)).

### Layouts

**Pills** (default): powerline-style capsules. Choose round, angled, slanted or flat shapes, and optionally a blank line between rows.

<p align="center">
  <img src="assets/screenshots/pills-dark.png" alt="agy-powerline Pills layout with the dark-aurora theme: model, context, project and git; Gemini 5h and 7d quotas with pace markers and resets; Claude/GPT and Argon weekly quotas" width="850">
</p>

<details>
<summary>On a light terminal</summary>

<p align="center">
  <img src="assets/screenshots/pills-light.png" alt="agy-powerline Pills layout with the light-paper theme on a light terminal" width="850">
</p>

</details>

**Lines**: the same information as plain colored text.

<p align="center">
  <img src="assets/screenshots/lines-dark.png" alt="agy-powerline Lines layout with the dark-aurora theme on a dark terminal" width="850">
</p>

<details>
<summary>On a light terminal</summary>

<p align="center">
  <img src="assets/screenshots/lines-light.png" alt="agy-powerline Lines layout with the light-paper theme on a light terminal" width="850">
</p>

</details>

**Classic**: plain colored text with `|` dividers and block meters, like `███░│░░░░░`.

<p align="center">
  <img src="assets/screenshots/classic-dark.png" alt="agy-powerline Classic layout with the dark-aurora theme on a dark terminal, with block meters" width="850">
</p>

<details>
<summary>On a light terminal</summary>

<p align="center">
  <img src="assets/screenshots/classic-light.png" alt="agy-powerline Classic layout with the light-paper theme on a light terminal" width="850">
</p>

</details>

## Widgets

| Widget                                                        | Shows                                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `model`                                                       | The model in use                                                                                         |
| `clock`                                                       | The current local time (12/24-hour format set under `clock`)                                             |
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
| `os`                                                          | System agy runs on: Windows, macOS, Linux or WSL                                                         |
| `host`                                                        | Current user and short hostname from the OS (`alex@devbox`)                                              |
| `customText`, `exec`                                          | Your own text, or the output of a [shell command](docs/configuration.md#shell-command-widget-exec)       |

A widget with nothing to show hides itself. Widgets can be recolored, renamed, given another icon, made label-free or given their own alert thresholds: see [Configuration](docs/configuration.md).

## Commands

| Command                                            | What it does                                                |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `npx agy-powerline init [--yes]`                   | Install or update the statusline                            |
| `npx agy-powerline configure`                      | Open the editor (alias `config`)                            |
| `npx agy-powerline preset <name>`                  | Apply a preset (`--list` to see them)                       |
| `npx agy-powerline theme <name>`                   | Switch theme (`--list`, `--gallery`)                        |
| `npx agy-powerline gradient <name>`                | Color each row with a gradient (`--list`, `off`)            |
| `npx agy-powerline layout <pills\|lines\|classic>` | Switch layout                                               |
| `npx agy-powerline caps <style>`                   | Switch the pill shape: `round`, `angled`, `slanted`, `flat` |
| `npx agy-powerline export [file]`                  | Save your config to a file, to back it up or share it       |
| `npx agy-powerline import <file>`                  | Load a config, after showing what changes (`--merge`)       |
| `npx agy-powerline doctor`                         | Check the install and explain what's wrong                  |
| `npx agy-powerline report`                         | Write a privacy-safe bug report                             |
| `npx agy-powerline uninstall [--delete]`           | Remove it from agy (`--delete` also removes its files)      |
| `npx agy-powerline render --demo`                  | Print the bar with sample data                              |

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

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=wassim-azi/agy-powerline&type=Date)](https://star-history.com/#wassim-azi/agy-powerline&Date)

## License

[MIT](LICENSE) © Wassim AZI
