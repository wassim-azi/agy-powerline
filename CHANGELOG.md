# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The statusline no longer hangs until Antigravity kills it when Antigravity keeps its input open without sending anything; repeated kills made Antigravity turn the statusline off (#13)

## [1.0.2] - 2026-10-11

### Security

- On macOS and Linux, the config, `exec` cache, problem log and payload dump are now readable by your account only, and saving Antigravity's `settings.json` keeps its permissions. Run `agy-powerline init --yes` after updating to apply this to existing files (#11)

## [1.0.1] - 2026-10-11

### Fixed

- WSL: the install notes and the Windows-Node error now recommend Node.js 20+ installed for your user (for example with nvm) instead of Ubuntu's often too old `/usr/bin/node` (#6)
- The git widget's uncommitted-changes color no longer looks like the caution color in the `light-paper`, `light-sky`, `light-sunset`, `dark-onyx`, `dark-metro` and `colorblind-light` themes (#7)

## [1.0.0] - 2026-10-11

First release of **agy-powerline**, a statusline for Google Antigravity's CLI (`agy`).

### Added

- **The bar**: a local Node script Antigravity runs on every refresh (about 0.1 s, no `npx`). Two layouts from one widget list, **Pills** (powerline capsules, the default) and **Lines** (colored text), showing the same information. It fits the terminal width, and widgets with nothing to show hide themselves.
- **Widgets**: model, agent state and plan; Gemini 5h and 7d quotas as meters with a pace marker, percentages and reset timers; the tightest quota; third-party quotas; context window and tokens; git branch with dirty state and ahead/behind; project, folder, sandbox, artifacts, RAM; custom text and shell commands (`exec`).
- **Look**: 15 themes tested for contrast (dark and light ones built from VS Code's default colors and from the Dracula, One Dark, Tokyo Night and Catppuccin Latte palettes, plus two color-blind safe) and a `custom` theme; four pill shapes (`round`, `angled`, `slanted`, `flat`); optional space between rows; five presets; ASCII mode and 256-color or no-color output for any terminal.
- **Commands**: `init` to install, `configure` for the interactive editor with a live preview, `preset`, `theme`, `layout` and `caps` to switch settings, `doctor` to check the install, `report` for privacy-safe bug reports, `uninstall`, and `render --demo`.
- **Safety and privacy**: no network calls, no telemetry, no runtime dependencies. Antigravity's `settings.json` is backed up and never lost; config is never read from the current directory; text from the payload, git and commands is stripped of terminal escape sequences; `exec` widgets run only from your own config.
- **Platforms**: Windows (cmd and PowerShell), macOS, Linux and WSL with Node.js 20 or newer, tested in CI on Node.js 20, 22 and 24.
