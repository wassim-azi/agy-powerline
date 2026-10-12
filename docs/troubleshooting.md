# Troubleshooting

- [Run `doctor` first](#run-doctor-first)
- [Common problems](#common-problems)
- [Reporting a bug](#reporting-a-bug)
- [Capturing the payload](#capturing-the-payload)

## Run `doctor` first

```bash
npx agy-powerline doctor
```

It checks the install without changing anything. It prints the platform (with WSL marker), Node binary, install dir, config path, settings path, the configured `statusLine.command`, `$TERM` / `$COLORTERM` and color depth, and runs a glyph test (`  󰊤 ⚡ 💻 🌿 ⏳ 💾`).

It then reports: Windows Node on WSL, stale installed scripts (fix: `npx agy-powerline init --yes`), missing `statusline.js`, command mismatch vs the current install, missing `statusLine.command`, `statusLine.enabled` set to `false`, and (on Windows) an install folder whose name breaks the launch command. Finally it runs the configured command with sample JSON and shows the first output line plus timing.

## Common problems

- **Broken glyphs (boxes or question marks):** your terminal font has no Nerd Font glyphs. Install a [Nerd Font](https://www.nerdfonts.com/), or turn on ASCII mode (`i` in `configure`). See [Terminals](configuration.md#terminals-ascii-mode-colors-narrow-windows).
- **The bar disappeared after you upgraded or removed Node** (nvm, Homebrew, ...): `init` saves the exact Node binary it ran with, and that one is gone. Run `npx agy-powerline init --yes` again; `doctor` shows the saved path in `command` and a failed `spawn` until then. See [What `init` does](install.md#what-init-does).
- **The bar doesn't change after an update:** run `npx agy-powerline init --yes`, then restart `agy`. See [Upgrading](install.md#upgrading).
- **`[agy-powerline: invalid statusline.config.json, showing defaults]`:** your config has a JSON error (often a trailing comma). The bar uses the defaults until you fix or delete the file; `doctor` prints the exact error. `configure` and the `theme`/`layout`/`preset`/`caps` commands refuse to save until then, so your widgets are never overwritten.
- **`init` refuses to edit `settings.json`:** the file isn't plain JSON (comments, trailing commas). Fix it, or add the `statusLine` entry by hand: see [Setting it up by hand](install.md#setting-it-up-by-hand).
- **Windows: the bar doesn't start:** the install folder path may contain `&`, `(`, `^`, `,`, `;` or `=`. See [What `init` does](install.md#what-init-does).
- **The demo shows widgets your live bar doesn't:** `render --demo` uses sample data. Widgets like `sandbox` and `artifacts` stay hidden in a real session until there is a sandbox or an artifact.

## Reporting a bug

agy-powerline keeps a small **problem log** on your machine, `~/.agy-powerline/agy-powerline.log`, so a bug report can say what actually went wrong. Nothing is ever sent anywhere: the file only leaves your computer if you attach it yourself.

```bash
npx agy-powerline report              # print the report
npx agy-powerline report -o report.md # or write it to a file to attach
```

Read it first: it's plain text, and everything it contains is listed below. Then paste it into a [GitHub issue](https://github.com/wassim-azi/agy-powerline/issues) or attach the file.

**What the report contains**

- **Problems** agy-powerline ran into: crashes, a broken config, an unreadable payload, a payload that didn't arrive within a second, slow refreshes (over 750 ms, with the widget ids that were on), `exec` timeouts, and `git` timeouts. Each one is listed once with a count, the error type, the lines of agy-powerline's own code involved, and the agy-powerline, Node and Antigravity version numbers.
- **Your system**: OS and version, CPU model and thread count, total and used memory, free disk space on the install drive, load average, terminal type and color support, the shell's name, and whether Node has full locale data.
- **Your setup**: whether the installed scripts match the CLI, whether Antigravity points at this install, whether the config is valid, the layout, theme, powerline style, on/off options, and the list of widget ids.

**What it never contains**: your name, username or hostname; any file or folder path; your email, session or conversation IDs, model text or token counts from Antigravity; branch names, working directories or remote URLs; `exec` commands or their output; custom text or labels; IP or network details; your time zone or locale. Error messages are cleaned of anything that looks like a path, email, URL, IP address or token before they are written, and JSON errors keep only the line and column.

The log keeps at most 200 entries (256 KB). Repeats of the same problem are counted at most once a minute. `npx agy-powerline report --clear` empties it, and `uninstall --delete` removes it.

**Turning it off**: set `"log": false` in `statusline.config.json`, or `AGY_POWERLINE_LOG=0` in your environment (this works even when the config file itself is broken).

`npx agy-powerline doctor --markdown` prints a shorter diagnostics table; it shows your home folder as `~`.

## Capturing the payload

To capture the JSON Antigravity sends to the statusline, set `AGY_POWERLINE_DEBUG=1`:

```bash
# Windows PowerShell:
$env:AGY_POWERLINE_DEBUG="1"

# macOS / Linux:
export AGY_POWERLINE_DEBUG=1
```

The next time Antigravity refreshes the bar, the payload is saved to `~/.agy-powerline/last-payload.json`, replacing the previous one on every refresh (unset the variable when you're done). `render --dump-payload <file>` or `AGY_POWERLINE_DUMP_PAYLOAD=<file>` save it elsewhere; a relative `AGY_POWERLINE_DUMP_PAYLOAD` file goes in the install folder, never in your project.

The file is safe to attach to an issue: it keeps only the fields the bar uses (model, quotas, tokens, context, agent state, counters, versions). Your email and session and conversation IDs are never written, paths become placeholders like `/home/user/project`, the branch name becomes a placeholder of the same length, and anything Antigravity adds in the future is left out until agy-powerline uses it. Replay it locally with:

```bash
cat ~/.agy-powerline/last-payload.json | npx agy-powerline render
```
