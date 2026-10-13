# Configuration

Everything about `statusline.config.json`, the file `npx agy-powerline configure` edits. It lives in the install folder (`~/.agy-powerline/`, or `AGY_POWERLINE_HOME`). The bar reads it on every refresh, so a running `agy` session picks up changes without a restart.

Most people never edit it by hand: `configure` covers widgets, order, presets, themes, layout and powerline glyphs. This page is for everything else.

- [Configurator keys](#configurator-keys)
- [Widgets](#widgets)
- [Widget options: colors, labels, minimalist mode](#widget-options)
- [Quota pace marker](#quota-pace-marker)
- [Reset times and clock](#reset-times-and-clock)
- [Alerts and thresholds](#alerts-and-thresholds)
- [Shell command widget (`exec`)](#shell-command-widget-exec)
- [Pills: powerline styles, glyphs and row gaps](#pills-powerline-styles-glyphs-and-row-gaps)
- [Custom theme](#custom-theme)
- [Terminals: ASCII mode, colors, narrow windows](#terminals-ascii-mode-colors-narrow-windows)

## Configurator keys

Tabs at the top lead to Widgets (`w`), Presets (`o`), Themes (`t`), Layout (`l`) and Powerline (`p`); a tab's letter opens it from any other tab, and `←` `→` or Tab / Shift+Tab move between them. Each screen shows its list, a live preview of your bar with on/off chips for the toggles (with their keys, on the widget list), and its keys at the bottom. In ASCII mode it uses plain `+-|` boxes, and without color it stays readable.

The editor fits your window. It fills the full width, so the preview has the room your bar gets in agy. From 80 columns the descriptions line up in a column; from 140 columns the list and a details panel share the width evenly, and the details show the selected item: a widget drawn on its own with its options and presets, a preset's rows, a theme's colors, or what a Powerline setting does. In a short window the tagline, blank lines, notes and preview chips make way first, then long lists scroll inside their panel, with the rows out of view counted in its border (`↑ 4 more`, `↓ 12 more`). Resizing the window redraws it.

Enter on a widget opens its options: color, label (shown or value only), and what that widget takes, such as the short model name, the reset timers' format, the custom badge's text, the caution and danger levels, blink and the pace marker. `↑` `↓` pick an option, `←` `→` or Enter change it, `x` sets it back to its default, and Esc returns to the list. Each change is saved right away and shows in the preview. A Shell Command's `cmd` is shown but edited only in the config file. The preview title says when it shows a theme, preset or layout you haven't applied yet, and the preset that matches your widgets is marked `current`.

| Key                    | Action                                                                            |
| ---------------------- | --------------------------------------------------------------------------------- |
| ↑↓                     | Move cursor (with circular wrap-around at top/bottom; theme preview updates live) |
| ←→, Tab, Shift+Tab     | Switch tab (Widgets, Presets, Themes, Layout, Powerline)                          |
| `w`                    | Widgets (your widget list)                                                        |
| Shift+↑↓               | Reorder widgets                                                                   |
| Enter                  | Edit the selected widget's options (see below)                                    |
| `a`                    | Add widget (includes live type-to-filter search across catalog)                   |
| `s`                    | Insert Flex Separator after the current item                                      |
| `n`                    | Insert New Line (next widgets go on the next row)                                 |
| `x`, Delete, Backspace | Remove                                                                            |
| `o`                    | Presets (`default`, `compact`, `workspace`, `limits`, `full`)                     |
| `t`                    | Themes (select `Custom` or press `c`/`e` to open in-TUI color editor)             |
| `l`                    | Layout (Pills or Lines)                                                           |
| `p`                    | Powerline (style, separators, start and end caps)                                 |
| `j`                    | Toggle joins (adjacent widgets share one pill, Pills layout)                      |
| `v`                    | Toggle space between rows (a blank line between Pills rows)                       |
| `e`                    | Toggle emojis                                                                     |
| `m`                    | Toggle minimalist mode (values only, no icons or labels)                          |
| `r`                    | Toggle the quota pace marker                                                      |
| `b`                    | Toggle alert blink (flash on critical quota/context breaches)                     |
| `i`                    | Toggle ASCII mode (plain-text caps/joins, no emojis)                              |
| `d`                    | Reset configuration to defaults                                                   |
| `g`                    | Open GitHub repository in browser (⭐ Repo)                                       |
| Enter                  | Confirm selection in Add/Themes/Presets/Layout/Powerline lists                    |
| Esc                    | Back to previous list / widget list                                               |
| `q` or Ctrl-C          | Save and quit (`q` doesn't quit while typing in the Add search or a code point)   |

## Widgets

Every value comes from the JSON Antigravity pipes on stdin. A widget with nothing to show hides itself: a model, quota, reset time, context window or token usage that is missing from the payload (or unusable) is left out, not shown as `Unknown`, `0%` or `now`.

- Model (`model.display_name`; `"short": true` shows `3.8 Flash·High` instead of `Gemini 3.8 Flash (High)`)
- Tightest quota (`quota` e.g. `⏳ 7d 28.6% rem · 11hr 35m`: of the quota buckets for the model in use, the one closest to running out; `gemini-*` buckets for Gemini models, `3p-*` for the others)
- 5h / 7d remaining quota meters (`fiveHourBar`, `weeklyBar`) with consumption-based fill direction, a [pace marker](#quota-pace-marker), and separate reset timers that show a countdown or the [exact reset time](#reset-times-and-clock) (`fiveHourReset`, `weeklyReset`)
- 3P 5h / 7d remaining quota (5h hidden while `disabled`)
- Context bar, %, tokens (`used_percentage`, `context_window_size`; the tokens are the used share of the window, so they always match the %. Without a window size, `current_usage` input plus cached tokens)
- Working directory (`cwd`, `~` for home), project folder (`workspace.project_dir`)
- VCS branch with dirty marker and remote sync indicators (`git` — `vcs.branch` `*`, `⇡2 ⇣1` ahead/behind; reads `.git` directly, including packed refs and linked worktrees, and runs `git rev-list` only when the branch tracks an upstream and points at a different commit)
- Session tokens (`totalTokens` e.g. `🪙 149.3K`: input + output tokens of the session; `"split": true` shows `123.1K↑ 355.0K↓`)
- Prompt cache hit rate (`cacheHit` e.g. `⚡ 85%`: share of the latest prompt read from cache)
- Custom shell command (`exec`, see [below](#shell-command-widget-exec))
- Custom text badge (`customText`, e.g. `{"id": "customText", "text": "Production"}` shows `🏷️ Production`; hidden without `text`)
- Plan tier, agent state, CLI version
- Artifact count
- Running subagents and background tasks (`tasks` e.g. `👥 2 subagents, 1 task`: subagents whose `status` is `running`, and `task_count`; hidden when nothing runs)
- Approval and Vim mode (`mode` e.g. `🧭 accept-edits, NORMAL`: `cycle_mode` and `vim.mode`; an approval mode shows in the caution color; hidden in the default mode with Vim editing off)
- Conversation title (`title` e.g. `💬 Fix the config loader`: `conversation_title` on one line, cut to 30 columns; hidden until the conversation has a title; among the first widgets dropped when a row doesn't fit)
- Cache read / create
- RAM usage of your machine (`ram`, read from the OS; caution color from 80%, danger from 90%)
- Sandbox with network security state (`sandbox (net)` vs `sandbox (isolated)`)
- Flex Separator (grows to fill `terminal_width`)
- New Line (starts another statusline row)

## Widget options

Any widget accepts these options:

```json
{ "id": "git", "color": "#ff8800", "textColor": "#1a1a1a", "bold": false, "raw": true }
```

- **`color`**: a theme color slot (`model`, `git`, `meta`, `caution`...), a basic name (`blue`, `green`, `orange`, `cyan`, `red`, `yellow`, `magenta`, `white`), or hex / `rgb(r, g, b)`. It's the pill color in Pills and the text color in Lines. Caution and danger colors still take over when a quota or the context runs low, so alerts never blend in.
- **`textColor`**: the text color (on the pill in Pills; the plain text parts in Lines).
- **`bold`**: `false` drops bold in Pills (on by default); `true` makes a Lines widget bold.
- **`raw`**: `true` shows only the value, without icon or label: `72.0% rem` instead of `⏳ 5h: 72.0% rem`.

**Minimalist mode** turns `raw` on for every widget, which makes the bar much narrower on small terminals. Set `"minimalist": true` or press `m` in `configure`. A widget with `"raw": false` keeps its label even then.

## Quota pace marker

Every 5h, 7d and third-party quota meter carries a marker, `┃` (`|` in ASCII mode), at the point the quota window has reached. The bar fills from the left as quota is used, so you can read it at a glance:

```
⏳ ███  ┃       72.0% rem    fill behind the marker: you're using quota slower than time passes
📅 ████████┃██   21.0% rem    fill past the marker: at this rate the quota runs out before it resets
```

The marker needs no extra data: it comes from the reset time Antigravity already sends and the fixed 5-hour and 7-day window lengths. It's hidden when the reset is further away than the window itself. Turn it off with `"pacing": false` (or `r` in `configure`), or per widget with `"pace": false`.

## Reset times and clock

`fiveHourReset` and `weeklyReset` can show when the quota resets instead of how long until it does:

```json
{ "id": "fiveHourReset", "format": "time" }
```

- **`format`**: `"countdown"` (`2hr 47m`, the default), `"time"` (`6:33pm`; weekly adds the date, `oct 10, 2:50pm`) or `"both"` (`6:33pm (2hr 47m)`).

How times look is set once for every widget under `"clock"`:

```json
{ "clock": { "hour12": false, "timeZone": "Europe/Paris", "locale": "fr-FR" } }
```

- **`hour12`**: `true` for `6:33pm`, `false` for `18:33`. Left out: 12-hour in the built-in style, or the locale's own habit when `locale` is set.
- **`timeZone`**: any IANA zone (`America/New_York`, `Asia/Tokyo`). Default: the machine's local time.
- **`locale`**: a language tag (`de-DE`, `ja-JP`) for localized month names and time formats (`10. Okt., 14:50`). Default: the compact built-in English style.

Unknown zones and locales are ignored. Everything comes from Node's built-in `Intl`; nothing is downloaded.

## Alerts and thresholds

Quota and context widgets change color as they get low or full: the theme's ok color, then caution, then danger. Critical ones can also blink.

```json
{
  "thresholds": {
    "quotaWarn": 20,
    "quotaCrit": 10,
    "contextWarn": 70,
    "contextCrit": 85,
    "blink": true
  }
}
```

- **`quotaWarn`** _(default: `30`%)_: remaining quota at which the 5h/7d widgets turn to the caution color.
- **`quotaCrit`** _(default: `10`%)_: remaining quota at which they turn to the danger color.
- **`contextWarn`** _(default: `70`%)_: used context at which the context widgets turn to the caution color.
- **`contextCrit`** _(default: `90`%)_: used context at which they turn to the danger color. Antigravity's `exceeds_200k_tokens` also triggers it.
- **`blink`** _(default: `false`)_: `true` makes danger-level widgets blink; `"warn"` makes caution-level ones blink too. ASCII mode never blinks. `b` in `configure` turns it on or off.
- **Per widget**: any quota or context widget takes its own `warn`, `crit` and `blink` (e.g. `{"id": "fiveHourBar", "warn": 20, "crit": 10, "blink": true}`).

## Shell command widget (`exec`)

Runs a shell command of your choice and shows the first line of its output:

```json
{
  "id": "exec",
  "cmd": "git stash list | wc -l",
  "label": "Stash",
  "icon": "📦",
  "interval": 10,
  "timeout": 500,
  "color": "git"
}
```

- **`cmd`** _(required)_: Shell command to execute. The first non-empty line of stdout is trimmed and rendered.
- **`interval`** _(optional, default: `10`s)_: how long the output is reused. Refreshes within the interval read it from a cache file (`.exec-cache.json`) shared by all agy windows, without running the command again; the command runs at most once per refresh.
- **`timeout`** _(optional, default: `500`ms, capped at `5000`ms)_: a command that takes longer is stopped; the widget keeps showing its last output, or hides if there is none.
- **`label`** _(optional)_: Text label prefix (e.g. `Stash: 3` in lines layout, `📦 Stash: 3` in pills layout).
- **`icon`** _(optional, default: `⚡`)_: Custom emoji/symbol. Set to `""` to hide the icon.
- **`color`** _(optional)_: a theme color slot or color name (e.g. `git`, `model`, `warn`, `blue`, `green`, `orange`, `cyan`).
- **Several at once**: unlike most widgets, `exec` can appear more than once (e.g. one for Git stashes, another for the Kubernetes context).

**Safety rules for `exec`:**

- The command runs on every refresh (subject to `interval`), in the session's working directory, with your user's permissions. Only add commands you would run in any repo.
- Commands only run from a config you own: the global install (`~/.agy-powerline`) or `AGY_POWERLINE_HOME`. A copy of the scripts anywhere else (for example committed inside a repo) shows `[blocked]`.
- CLI previews (`configure`, `theme`, `layout`, `preset`, `caps`, `render --demo` and the preview in `doctor`) never run commands; they show `[cmd]` instead. `doctor`'s live check runs your configured statusline once, as Antigravity does, so `exec` widgets run there.
- Output is stripped of escape sequences and control characters and capped at 80 characters.

## Pills: powerline styles, glyphs and row gaps

### Powerline styles

A style sets start caps, end caps and separators in one go. Switch with `npx agy-powerline caps <style>` or cycle **Style** in the TUI (`p`):

| Style             | Caps | Join | Look                                   |
| ----------------- | ---- | ---- | -------------------------------------- |
| `round` (default) | `/`  | ``   | Rounded capsules with rounded joins    |
| `angled`          | `/`  | ``   | Traditional Powerline arrows           |
| `slanted`         | `/`  | ``   | Diagonal cuts at both ends and between |
| `flat`            | none | none | Flush rectangular blocks               |

### Custom caps and separators

Every glyph is configurable under `"powerline"`, written as a hex code point:

```json
"powerline": {
  "enabled": true,
  "separators": ["E0B0", "E0B4"],
  "separatorInvert": [false, false],
  "startCaps": ["E0B6"],
  "endCaps": ["E0B4"]
}
```

- `enabled`: join adjacent widgets into one pill. `false` gives every widget its own pill.
- `separators`, `startCaps`, `endCaps`: lists of code points (`"E0B0"`, `"U+E0B0"` and `"0xE0B0"` all work). With several glyphs, separators cycle per join and caps cycle per pill, left to right. An empty list turns that slot off.
- `separatorInvert`: one flag per separator. Left-pointing glyphs (`E0B2`, `E0B6`) need `true` so they take the next widget's color on the previous widget's background.
- A separator between two widgets of the same color is drawn in the text color, so it never disappears.
- Each entry must be one printable character (Nerd Font glyphs, box drawing, emoji...). Control and invisible characters are dropped, so a config file can't inject terminal escape sequences.

In the TUI, press `p`, then Enter on **Separators**, **Start caps** or **End caps**: `←` `→` cycle presets (triangle, round, diagonal), `a`/`i` add or insert, `x` removes, `c` clears, `h` types any code point, and `v` toggles invert on a separator.

### Space between rows

Pills fill the whole height of a terminal line, so stacked rows touch. `"rowGap": true` puts a blank line between Pills rows; it's off by default because the bar then takes more lines (three rows become five). Toggle it with `v` in `configure`, or **Space between rows** in the Powerline tab (`p`). Lines rows don't need it and are left alone.

## Custom theme

Set `"theme": "custom"` (or run `npx agy-powerline theme custom`), and define a `customTheme` object with Hex (`#RRGGBB` or `#RGB`), RGB array `[r, g, b]`, or `"rgb(r, g, b)"`. `configure` also has a color editor (`t`, then `Custom`).

```json
{
  "theme": "custom",
  "customTheme": {
    "name": "Cyberpunk",
    "base": "dark-ocean",
    "colors": {
      "model": "#ff007f",
      "context": "#00ffff",
      "fiveHour": [80, 250, 123],
      "weekly": "rgb(189, 147, 249)",
      "git": "#ffb86c",
      "meta": "#f8f8f2",
      "caution": "#f1fa8c",
      "warn": "#ff5555"
    }
  }
}
```

- Any colors omitted automatically inherit from `"base"` (defaults to `"dark-aurora"`). Pick a `light-*` base for a light terminal.
- Color roles: `text` (text on pills), `fiveHour` (healthy status), `caution` (getting low), `warn` (critical), `gitDirty` (uncommitted changes), `track` (empty dots in the lines layout), plus widget colors `model`, `weekly`, `thirdParty`, `context`, `git` and `meta`.
- Pill caps use the terminal's own background. Set `terminal` to pin a cap background color instead.

Every built-in theme is tested to keep text at WCAG AA contrast (4.5:1) on pills and on its terminal background, and to keep the three status colors (ok, caution, danger) clearly different. The color-blind themes also keep the status colors apart under simulated protanopia, deuteranopia and tritanopia.

## Terminals: ASCII mode, colors, narrow windows

**No Nerd Font?** Enable ASCII mode: caps and separators become plain text (`[` `]`, `<` `>`, `/`; joins default to `>`), dot meters become `#`/`-`, markers become `*`, and emojis turn off. Toggle with `i` in the TUI, set `"ascii": true`, pass `render --ascii`, or export `AGY_POWERLINE_ASCII=1`.

**Narrow terminals**: the bar never runs past the `terminal_width` Antigravity reports. A row that is too wide first drops icons and labels (values only, as in [minimalist mode](#widget-options)), then shortens the model name (`3.8 Flash·High`) and the Lines meters (12 dots instead of 25), then hides its least important widgets one by one (custom text, version and cache counters first; the model and the 5h quota last), and as a last resort is cut with `…`. Widths count wide emojis and East Asian characters as two columns.

**Limited color support?** Color depth resolves per refresh, strongest hint first: `render --color <truecolor|256|none>`, then `NO_COLOR` (disables color), then `AGY_POWERLINE_COLOR`, then `"color"` in the config (`"auto"` default), then terminal heuristics (`COLORTERM=truecolor`/`24bit` → truecolor, `*256color*` `TERM` → 256-color `38;5`/`48;5` codes, `dumb` → no color). Bold/dim are kept; only fg/bg color is dropped in `none` mode, and Pills meters draw their fill with `█`/`░` (`#`/`-` in ASCII mode) instead of color.
