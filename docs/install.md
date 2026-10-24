# Installation details

What `npx agy-powerline init` does, where files go, and how to set things up by hand. For the quick version, see the [README](../README.md#install).

- [What `init` does](#what-init-does)
- [Install from inside agy (plugin)](#install-from-inside-agy-plugin)
- [Install without npm](#install-without-npm)
- [Where files live](#where-files-live)
- [Upgrading](#upgrading)
- [Uninstalling](#uninstalling)
- [Setting it up by hand](#setting-it-up-by-hand)
- [WSL](#wsl)
- [Performance](#performance)

## What `init` does

`init` copies the scripts to `~/.agy-powerline` and adds a `statusLine` entry to Antigravity's `settings.json`. It asks before overwriting existing scripts or another `statusLine`; pass `--yes` to skip the prompts (required without a TTY). Restart `agy` (or open a new session) after `init` so it reloads settings.

On a first install in a terminal (no `statusline.config.json` yet, no `--yes`), `init` asks three questions, each with a preview of the bar it gives:

1. **Preset:** `default`, `compact`, `agent`, `git`, `tokens`, `quotas` or `full`. Enter keeps `default`.
2. **Layout:** `pills` or `lines`. Enter keeps `pills`.
3. **Terminal background:** dark, light or color-blind, then the themes for it (Enter keeps `dark-aurora`, `light-paper` or `colorblind-dark`).

Answer with the number of a choice. `npx agy-powerline preset`, `layout`, `theme` and `configure` change your choice later. Without a terminal, or with `--yes`, nothing is asked and you get the default bar. Running `init` again never replaces your config.

For scripted installs, `--preset <id>`, `--layout <id>` and `--theme <id>` set those choices and skip their question, with or without `--yes`. The theme also takes `dark`, `light` and `colorblind`. Each value is checked before anything is written: an unknown one stops `init` with the list of valid ids. With an existing config, the flags change only those settings in it, and `init` says so.

```sh
npx agy-powerline init --yes --preset compact --layout lines --theme light
```

`init` never loses your other settings. It refuses to touch a `settings.json` that is not plain JSON (comments, trailing commas) and tells you what to add by hand. Before every change it saves the previous file as `settings.json.agy-powerline.bak`. The first time, it also keeps your untouched file as `settings.json.agy-powerline.original.bak`, which later runs never replace. A `settings.json` linked into place by a dotfile manager (stow, chezmoi, yadm) stays a link: the change goes into the file it points to.

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

To try a different look without changing `statusline.config.json`, append render flags to the command. For example:

```text
'/usr/bin/node' '/home/you/.agy-powerline/statusline.js' --theme light-paper --layout lines
C:/Users/you/.agy-powerline/statusline.cmd --theme light-paper --layout lines
```

The same `--preset`, `--layout`, `--theme`, `--caps` and `--gradient` options work on both platforms. The Windows launcher forwards them to `statusline.js`; an install made before these flags existed needs one `npx agy-powerline init --yes` to get that launcher. A later `init` keeps the flags you appended, as long as the command before them is still the one it writes. `doctor` lists them under `overrides`.

`init` also writes `install.json` (installed CLI version, Node path, platform, timestamp) and a default `statusline.config.json` (only when none exists).

Options: `--stack` renders below the built-in statusline, `--padding <n>` inserts blank lines.

On Windows, `init` refuses an install folder whose path contains `&`, `(`, `^`, `,`, `;` or `=`: Antigravity starts the bar through `cmd /c`, which splits the command at those characters. Set `AGY_POWERLINE_HOME` permanently to a folder without them (for example `setx AGY_POWERLINE_HOME C:\agy-powerline`), open a new terminal and run `init` again.

## Install from inside agy (plugin)

The repository is also an agy plugin with two skills:

```sh
agy plugin install https://github.com/wassim-azi/agy-powerline   # or /plugin install … inside agy
```

- **`agy-powerline-setup`** checks that Node.js is 20 or newer, runs `npx -y agy-powerline@latest init --yes`, then `npx agy-powerline doctor`, sums up the result and asks you to restart agy once. If npx can't reach npm, it runs the same commands from the plugin's own copy instead ([Install without npm](#install-without-npm)). Run it with `/agy-powerline-setup`, or just ask agy to set up agy-powerline.
- **`agy-powerline-customize`** maps requests such as "make it light", "show only one line" or "add a gradient" to the `theme`, `preset`, `layout`, `caps`, `gradient`, `export` and `import` commands: it lists the choices first, then applies one and shows the preview.

The skills run commands through agy's shell tool, so agy asks you before each one, as for any command. They never edit `settings.json` by hand, never start `configure` (an interactive editor) and never pass `--allow-exec` to `import` without your yes to the commands shown.

agy copies the plugin to `~/.gemini/config/plugins/agy-powerline/`. The bar itself still runs from `~/.agy-powerline`, where `init` installs it.

- **Update:** run the setup skill again, or `npx agy-powerline@latest init --yes`. Reinstall the plugin to get newer skills.
- **Remove:** `agy plugin uninstall agy-powerline` removes the skills only; the bar stays. `npx agy-powerline uninstall` removes the bar from agy's settings (add `--delete` to remove its files).
- **macOS:** if installing from the GitHub URL fails with `unsupported extension format` (google-antigravity/antigravity-cli#327, closed upstream), update agy, or clone the repository and run `agy plugin install <path to the clone>`.

## Install without npm

Where npm or cloning from GitHub is blocked, each [GitHub release](https://github.com/wassim-azi/agy-powerline/releases) has files you can download once and install from. Node.js 20 or newer is still needed; agy-powerline has no dependencies to fetch.

- **The bar only:** `agy-powerline-<version>.tgz` is the npm package. Extract it and run `init` from it:

  ```sh
  tar -xzf agy-powerline-<version>.tgz
  node package/src/index.js init --yes
  ```

- **The plugin, with its skills:** `agy-powerline-plugin-<version>.zip` (or `.tar.gz`) holds an `agy-powerline` folder. Extract it, then install that folder:

  ```sh
  agy plugin install ./agy-powerline
  ```

  Then run the setup skill. When npx can't reach npm, it runs `init` and `doctor` from the plugin's copy in `~/.gemini/config/plugins/agy-powerline/`, so you get the version the archive came with.

Restart agy once afterwards, as after any `init`. Later commands work the same way: `node <folder>/src/index.js theme --list` stands in for `npx agy-powerline theme --list`. To update, download the newer release's file and repeat.

Each of these files has a signed attestation next to it (`<file>.sigstore.json`); [SECURITY.md](../SECURITY.md) shows how to check a download with `gh attestation verify`.

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
- The branch and dirty state come from the payload or from reading `.git` directly. The only process the default bar starts on its own is `git rev-list` for ahead/behind counts, only when the branch tracks an upstream and points at a different commit, with a 150 ms timeout. The counts are kept per pair of commits (`.git-sync-cache.json` in the install folder), so `git` runs again only when the branch or its upstream moves.
- The `gitFiles` and `gitChanges` widgets, when you add them, run `git status` or `git diff` with a 300 ms timeout. Their counts are kept for 5 seconds per repository and commit (`.git-status-cache.json`), so `git` runs at most once every 5 seconds per repository, and again at once after a commit or checkout. `gitSha`, `gitStash` and `gitWorktree` read `.git` without starting a process.
- The `tokensToday` and `tokensWeek` widgets, when you add them, read agy's conversation databases changed in the last 8 days, read-only. Each database's totals are kept in `.usage-cache.json` and it is read again only when it changes (its size or time); reading stops for the refresh after about 100 ms, and the rest is read on the next one. Nothing starts a process.
- `exec` widgets you add run with their own timeout and cache (see [Shell command widget](configuration.md#shell-command-widget-exec)).
