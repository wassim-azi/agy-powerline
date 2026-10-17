# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `dark-macchiato` theme: Catppuccin Macchiato palette (#33, thanks @yatharth2soni)

### Changed

- `init` ends with a link to the project page

### Fixed

- The statusline exits quietly when Antigravity closes its output pipe (#45, thanks @dannyward630)
- `init` and `uninstall` keep a `settings.json` symlinked by a dotfile manager (stow, chezmoi, yadm) as a link and write the change into the file it points to; they used to replace the link with a plain file, so the real file never got the change. The same goes for a symlinked `statusline.config.json`
- A second `init` no longer loses your original `settings.json`: the first backup is now kept as `settings.json.agy-powerline.original.bak` and never replaced, next to the latest one
- `configure` describes the `git` widget fully: its list and details panel now mention the ahead/behind counts it shows, not only the branch and uncommitted changes

## [1.2.0] - 2026-10-16

- `clock` widget: displays the current time in both Pills and Lines layouts, with configurable 12/24-hour formatting.

### Added

- `configure` edits a widget's options: Enter on a widget sets its color, label, caution and danger levels, blink, pace marker, reset format, short model name or badge text, with the preview following each change (#29)
- The README in Simplified Chinese (`README.zh-CN.md`) and Japanese (`README.ja.md`), with a language switcher at the top of each README (#34)
- `argonWeekly` and `argonReset` widgets show Gemini 4 Argon's own weekly quota on Google AI Pro and when it resets, whatever model you're using; the `limits` preset gets them as a fourth row, which hides when there's no Argon quota (#38)

### Changed

- `configure` fits your window: it fills the full width instead of stopping at 120 columns, lines descriptions up in a column, splits the width evenly between the list and a details panel from 140 columns (the selected widget drawn on its own with its options, a preset's rows, a theme's colors), scrolls long lists inside their panel in short windows instead of pushing the screen out of view, and redraws when the window is resized; it also gets a fresher look: a header with the GitHub star link and the navigation keys at the right end, the active tab and the selected item as rounded pills, widget icons in the lists, accent-colored panel titles, and details with headings, preset tags and color blocks (#29)
- `configure` is clearer about state: only widgets are numbered (flex spaces and new rows aren't), the preview title says when it shows a theme, preset or layout that isn't applied, the preset matching your widgets is marked `current` and lists its widgets with their icons, and a theme's details include a sample of the editor in that theme (#29)

### Fixed

- The context widgets' token count matches the percentage next to it: it was input plus output tokens only, leaving out cached tokens (e.g. `5.3K/1.0M (11.7%)`), and is now the used share of the window (`123.1K/1.0M (11.7%)`) (#31)
- The tightest quota widget no longer shows Gemini 4 Argon's separate weekly quota (Google AI Pro) while another Gemini model is in use, under a cut-off name like `gemini-argon-wtu-wee`; it shows that quota as `Argon 7d` when Argon is the model in use (#37)

## [1.1.1] - 2026-10-12

### Changed

- The statusline is installed as a single `statusline.js` instead of about 16 files, which cuts agy-powerline's own share of each refresh by about a third on Windows; run `npx agy-powerline init --yes` to switch, and `init` removes the old files (#23)
- The ahead/behind counts are kept per pair of commits, so a branch that is ahead of or behind its upstream no longer starts `git` on every refresh (about 60 ms each on Windows) (#24)

## [1.1.0] - 2026-10-12

### Added

- `tasks` widget: running subagents and background tasks, e.g. `👥 2 subagents, 1 task`, hidden when nothing runs; part of the `full` preset (#14)
- `mode` widget: the approval mode (e.g. `accept-edits`) and the Vim mode, which Antigravity's own status line shows; hidden in the default mode with Vim editing off; part of the `workspace` and `full` presets (#15)
- `title` widget: the conversation's title on one line, cut to 30 columns, hidden until the conversation has one (#16)

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
