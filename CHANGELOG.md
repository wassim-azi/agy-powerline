# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `"language"` setting for the bar's own words (labels, `rem`, units), set with `init --language` or tried with `render --language`; a code without messages shows English (#102)

## [1.6.0] - 2026-10-24

### Added

- Per-render `preset`, `layout`, `theme`, `caps` and `gradient` overrides for CLI previews and the installed statusline (#100, thanks @dannyward630)
- `sessionTime` shows how long the active conversation has been running (#96, thanks @dannyward630)
- `light-tokyo-night` theme with the Tokyo Night Light palette, deepened where the contrast checks need it (#65, thanks @dannyward630)
- The README in Spanish (README.es.md) (#52, thanks @unkletayo)
- The README in Korean (README.ko.md) (#53, thanks @rahul05ranjan)
- `light-gruvbox` theme: the light mode of Gruvbox, deepened where the contrast checks need it (#66, thanks @rahul05ranjan)
- agy-powerline.com has a home page that explains the bar with a live theme and layout preview, a theme gallery at /themes/, the docs with a sidebar and copy buttons, guides, every widget with a preview, a quota pace calculator, an FAQ and a French home page, all built from the repo, with a share card for every page
- A JSON Schema for `statusline.config.json` (https://agy-powerline.com/schema/v1.json): `init`, `export` and the browser configurator write its `$schema` line, so editors such as VS Code complete and check the file
- Two dark themes with the Nord and Rosé Pine palettes: `dark-nord` and `dark-rose-pine`
- `init` and `--help` show the site's address

## [1.5.0] - 2026-10-21

### Added

- Folder depth for `cwd` and per-widget maximum widths for selected values (#98, thanks @dannyward630)
- Per-widget quota and context visibility thresholds in the bar and `configure` (#99, thanks @dannyward630)
- `clock` widget shows the current local time, in the 12/24-hour format set under `clock` (#46, thanks @Ashuge11)
- Optional `os` widget shows Windows, macOS, Linux or WSL (#63, thanks @dannyward630)
- Opt-in `host` widget shows the current user and short hostname; `doctor` shows them as `user@host`, since its output gets pasted into issues (#62, thanks @dannyward630)
- Every widget takes its own `label` and `icon`, in the config file and in `configure` (Label text, Icon) (#97)
- `llms.txt` in the package: install, commands, widgets, themes and presets in one file for AI assistants (#130, thanks @dannyward630)

### Fixed

- `cwd` widget shows a path written for another OS (a Windows path on Linux or WSL, a POSIX path on Windows) as it is, instead of joining it to the current folder (#134, thanks @dannyward630)

## [1.4.0] - 2026-10-20

### Added

- `rings` meter style (`●●●○○○`) and `ramp` meter style (`███░░░`, each filled cell shaded from the theme's ok color through caution to danger); pick them with `"meterStyle"` or per widget in `configure`
- `classic` layout: plain colored text with `|` dividers and block meters (`███░│░░░░░`); `npx agy-powerline layout classic` or `l` in `configure`
- CodeQL static code analysis workflow (`.github/workflows/codeql.yml`)
- README badges for the live web configurator, GitHub stars, CodeQL, and OS platform logos
- Star History chart in READMEs
- `git` preset (project, branch, worktree, stash; changed files and lines, commit) and `tokens` preset (session tokens, cache hit, tokens today and over 7 days)
- Each GitHub release has plugin archives attached (`agy-powerline-plugin-<version>.zip` and `.tar.gz`), for `agy plugin install` where npm or cloning from GitHub is blocked; `docs/install.md` → Install without npm (#123)

### Changed

- Space between rows (`"rowGap"`, `v` in `configure`) works in every layout, not only Pills
- Pills draw meters as small dots (`pips`), with a larger dot as the pace marker, instead of solid colored blocks; `"meterStyle": "cells"` keeps the blocks, and ASCII mode keeps them too
- The setup and customize skills run commands from the plugin's own copy when npx can't reach npm (#123)
- `configure` → Themes shows a theme's palette in two columns with space between the pills
- Presets are named after what they show: Default, Compact, Agent activity, Git focus, Token usage, Quota watch and Everything
- The `workspace` preset is now `agent` (agent state, subagents, title, mode and sandbox; model, context %, artifacts, tightest quota), and `limits` is now `quotas`, in three rows: plan and model, then the 5h and 7d quotas side by side, then third-party and Argon

### Removed

- The preset names `workspace` and `limits`: use `agent` and `quotas`. `preset workspace`, `preset limits` and `init --preset` with either name stop with an error that lists the presets; saved configs keep working

### Fixed

- In the Pills layout, two neighboring widgets of the same color (a quota meter and its reset) are divided by a thin line instead of a solid black arrow or half-circle
- Pill caps and separators are no longer drawn in bold, which some fonts draw wider or shifted
- The flat style (no end caps) no longer paints the space after a pill in that pill's color
- With joins off, a row's pills sit one space apart and only Flex Separators spread them, instead of every gap stretching
- Without color, pills no longer show solid caps and joins as blocks of text color
- ASCII joins (`>`) are drawn in the text color, readable on any pill
- In 256-color mode, colors map to the nearest terminal color (near-black text was navy blue), and widgets whose colors land on the same code get a visible divider

### Security

- Each GitHub release has the npm tarball attached with its signed build attestation; check it with `gh attestation verify` (see `SECURITY.md`) (#117)
- The plugin archives on each release have the same signed build attestation as the tarball (#123)

## [1.3.0] - 2026-10-18

### Added

- `dark-macchiato` theme: Catppuccin Macchiato palette (#33, thanks @yatharth2soni)
- Gradients: `"gradient": "sunset"` (or `npx agy-powerline gradient sunset`) colors each row with one sweep from left to right, from eight presets or your own hex colors, with text kept readable and caution and danger colors kept as they are (#80)
- `exec` widgets can read the session JSON on stdin with `"payload": true` (your email and session IDs are removed first) and keep the colors their command prints with `"colors": true`; `docs/configuration.md` has recipes (#81)
- Git detail widgets, each opt-in: `gitChanges` (lines added and removed), `gitFiles` (staged, modified, untracked and conflicted files), `gitSha` (commit ID), `gitStash` (stash count) and `gitWorktree` (linked worktree name); with `gitFiles` on the bar, the `git` widget's dirty marker also counts uncommitted files (#82)
- `npx agy-powerline export [file]` and `npx agy-powerline import <file>` save and load your config: import shows what changes and previews the bar first, `--merge` changes only the settings in the file, new shell commands need their own confirmation or `--allow-exec`, and the previous config is kept as `statusline.config.json.bak` (#83)
- The README in French (`README.fr.md`) (#51, thanks @dharamdan01)
- Recipe: today's agy tokens from ccusage in the bar, with an `exec` widget (`docs/configuration.md` → Recipes) (#90)
- agy plugin: `agy plugin install https://github.com/wassim-azi/agy-powerline` adds an `agy-powerline-setup` skill that installs the bar from inside agy (`init`, then `doctor`) and an `agy-powerline-customize` skill that changes its theme, preset, layout, caps or gradient on request (#89)
- A first `init` in a terminal asks for a preset, a layout and a theme, with a preview of each; `--preset`, `--layout` and `--theme` answer them for scripted installs and change only those settings in an existing config (#91)
- `tokensToday` and `tokensWeek` widgets: tokens used today and over the last 7 days in all your agy conversations, read from agy's own local data (no network), with `"split"` and an optional `"budget"` that alerts like the context widgets; they need Node 22.13 or newer (#94)
- Meter styles: `"meterStyle": "blocks"` (or `"meter"` on one meter widget, also in `configure`) draws the quota and context meters as `blocks`, `shade`, `line`, `geometric`, `squares`, `braille`, `bars` or `dots` instead of each layout's own; ASCII mode keeps `#` and `-` (#93)
- The `git` widget shows a rebase (with its step, `REBASE 2/5`), `git am`, merge, cherry-pick, revert or bisect in progress, and the branch being rebased instead of a commit ID; `"operation": false` hides it (#92)
- Theme gallery online at https://agy-powerline.com/: every theme rendered by the real statusline code on dark and light terminals, with a color-blindness simulation (#110)
- Web configurator on GitHub Pages (https://agy-powerline.com/configure/): build your bar in the browser with live previews, themes, layouts, widget options, shareable URL links, and config export (#95)

### Changed

- `init` ends with a link to the project page
- The Pages site (https://agy-powerline.com/) shares a header, footer, design tokens, SVG favicon, dark/light/system theme toggle, terminal window frames and 404 page across the theme gallery and web configurator, with a hero section and one-click theme links on the gallery (#114)

### Fixed

- Exec widget intervals are always read in seconds; values of 1000 or more were read as milliseconds (#68, thanks @hiyouwhatsapp).
- The statusline exits quietly when Antigravity closes its output pipe (#45, thanks @dannyward630)
- `init` and `uninstall` keep a `settings.json` symlinked by a dotfile manager (stow, chezmoi, yadm) as a link and write the change into the file it points to; they used to replace the link with a plain file, so the real file never got the change. The same goes for a symlinked `statusline.config.json`
- A second `init` no longer loses your original `settings.json`: the first backup is now kept as `settings.json.agy-powerline.original.bak` and never replaced, next to the latest one
- `configure` describes the `git` widget fully: its list and details panel now mention the ahead/behind counts it shows, not only the branch and uncommitted changes

## [1.2.0] - 2026-10-16

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
