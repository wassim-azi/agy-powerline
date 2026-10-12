# Installation details

What `npx agy-powerline init` does, where files go, and how to set things up by hand. For the quick version, see the [README](../README.md#install).

- [What `init` does](#what-init-does)
- [Where files live](#where-files-live)
- [Upgrading](#upgrading)
- [Uninstalling](#uninstalling)
- [Setting it up by hand](#setting-it-up-by-hand)
- [WSL](#wsl)
- [Performance](#performance)

## What `init` does

`init` copies the scripts to `~/.agy-powerline` and adds a `statusLine` entry to Antigravity's `settings.json`. It asks before overwriting existing scripts or another `statusLine`; pass `--yes` to skip the prompts (required without a TTY). Restart `agy` (or open a new session) after `init` so it reloads settings.

`init` never loses your other settings. It refuses to touch a `settings.json` that is not plain JSON (comments, trailing commas) and tells you what to add by hand. Before every change it saves the previous file as `settings.json.agy-powerline.bak`.

| OS      | Scripts                           | `statusLine.command` in settings                                     |
| ------- | --------------------------------- | -------------------------------------------------------------------- |
| Windows | `statusline.js`, `statusline.cmd` | `C:/Users/you/.agy-powerline/statusline.cmd` (no quotes)             |
| macOS   | `statusline.js`                   | `'/opt/homebrew/bin/node' '/Users/you/.agy-powerline/statusline.js'` |
| Linux   | `statusline.js`                   | `'/usr/bin/node' '/home/you/.agy-powerline/statusline.js'`           |

- The Node path is the binary that ran `init` (`process.execPath`), not a hard-coded Homebrew or `/usr/bin` path, so the bar works even when Antigravity starts without your shell's `PATH` (for example with nvm). If you later remove that Node version, run `init --yes` again with the new one.
- On macOS and Linux the settings run `node statusline.js` directly, so no launcher file is written. They use `sh -c` with single-quoted Node and script paths so spaces in the home folder stay intact.
- Windows uses `statusline.cmd` because Antigravity runs `cmd /c`. Do not put quotes around the `.cmd` path in `settings.json`.
- Starting `agy` from cmd, PowerShell, bash, zsh, or fish does not change this. Antigravity spawns the statusline itself.
- A refresh never calls `npx`: the statusline command is a local Node script. `npx agy-powerline render` reads Antigravity's JSON on stdin and prints the bar; piped JSON with no subcommand renders too.

`init` also writes `install.json` (installed CLI version, Node path, platform, timestamp) and a default `statusline.config.json` (only when none exists).

Options: `--stack` renders below the built-in statusline, `--padding <n>` inserts blank lines.

On Windows, `init` refuses an install folder whose path contains `&`, `(`, `^`, `,`, `;` or `=`: Antigravity starts the bar through `cmd /c`, which splits the command at those characters. Set `AGY_POWERLINE_HOME` permanently to a folder without them (for example `setx AGY_POWERLINE_HOME C:\agy-powerline`), open a new terminal and run `init` again.

## Where files live

| Scripts and config  | Antigravity settings                      |
| ------------------- | ----------------------------------------- |
| `~/.agy-powerline/` | `~/.gemini/antigravity-cli/settings.json` |

On Windows those resolve to `%USERPROFILE%\.agy-powerline\` and `%USERPROFILE%\.gemini\antigravity-cli\settings.json`. Override the install folder with `AGY_POWERLINE_HOME`.

There are no per-project installs. Commands never read `./.agy-powerline` from the current directory, so a cloned repo cannot inject its own config.

## Upgrading

Antigravity runs the local copy of the scripts in `~/.agy-powerline`, so a newer package version reaches the bar only after you run `init` again:

```bash
npx agy-powerline init --yes   # overwrite the installed scripts with this version
npx agy-powerline doctor       # check everything is up to date and working
```

Your `statusline.config.json` is kept. `doctor` compares `install.json` against the running CLI version and warns if the scripts are stale. Restart `agy` or open a new session to load the update.

## Uninstalling

```bash
npx agy-powerline uninstall            # remove statusLine from Antigravity's settings
npx agy-powerline uninstall --delete   # also remove the files init installed
```

`uninstall` only removes a `statusLine` that looks like ours (or exactly matches this install). A foreign `statusLine` is left in place unless you pass `--yes`. Without `--delete` the scripts and `statusline.config.json` stay on disk. `--delete` only removes the files agy-powerline created, refuses to run on a folder without `install.json` or `statusline.js`, and keeps the folder if you put other files in it.

## Setting it up by hand

If you skip the settings step in `init`, add `statusLine` to `~/.gemini/antigravity-cli/settings.json` (Windows: `%USERPROFILE%\.gemini\antigravity-cli\settings.json`). Use absolute paths: Antigravity does not expand `~`. Prefer forward slashes. Restart `agy` after editing this file.

**Linux**

```json
{
  "statusLine": {
    "type": "command",
    "command": "'/usr/bin/node' '/home/you/.agy-powerline/statusline.js'"
  }
}
```

**macOS**

```json
{
  "statusLine": {
    "type": "command",
    "command": "'/opt/homebrew/bin/node' '/Users/you/.agy-powerline/statusline.js'"
  }
}
```

Use the Node binary from `which node` (Homebrew Apple Silicon is often `/opt/homebrew/bin/node`; Intel Homebrew is often `/usr/local/bin/node`; nvm is under `~/.nvm/...`).

**Windows** (cmd or PowerShell)

Point at the `statusline.cmd` launcher `init` writes. Do not quote the path: Antigravity runs `cmd /c` through Go, extra quotes become `\"...\"` and cmd cannot find `node.exe`. `statusline.cmd` already quotes `node.exe` internally, including `C:\Program Files\nodejs\node.exe`.

```json
{
  "statusLine": {
    "type": "command",
    "command": "C:/Users/you/.agy-powerline/statusline.cmd"
  }
}
```

Inside agy you can also use `/statusline <command>`, or go back to the built-in bar with `/statusline reset`.

## WSL

Install agy-powerline with a **Linux** Node.js 20 or newer, inside WSL. Ubuntu's `apt` package (`/usr/bin/node`) is often older (Ubuntu 24.04 ships Node 18), and a global install with it needs `sudo`, which would make `init` write into root's home folder. Install Node for your user instead, for example with [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 24
npm install -g agy-powerline
agy-powerline init
```

`which node` should point into your Linux home (`~/.nvm/...`), not `/mnt/c/...`: Windows `npx` is often on the WSL `PATH` via `/mnt/c/Program Files/nodejs/npx`, which would write a Windows Node path into Linux settings. `init` and `doctor` refuse to run under a Windows Node binary and tell you to re-run with Linux Node.

## Performance

Antigravity starts the statusline on every refresh, so that path stays small:

- agy-powerline's own work takes about 0.1 s per refresh on a Windows 11 laptop. Starting `cmd` and Node comes on top of that for any statusline command, about 0.1–0.25 s there depending on how busy the machine is (measured through `cmd /c`, the way Antigravity runs it on Windows).
- The statusline command is one local Node script, installed as a single file so Node opens one file instead of about 16: no `npx`, jq, bash or ccusage.
- Model, context, quotas and `vcs` come straight from Antigravity's JSON, and the flex layout uses its `terminal_width`.
- The branch and dirty state come from the payload or from reading `.git` directly. The only process the bar starts on its own is `git rev-list` for ahead/behind counts, only when the branch tracks an upstream and points at a different commit, with a 150 ms timeout. The counts are kept per pair of commits (`.git-sync-cache.json` in the install folder), so `git` runs again only when the branch or its upstream moves.
- `exec` widgets you add run with their own timeout and cache (see [Shell command widget](configuration.md#shell-command-widget-exec)).
