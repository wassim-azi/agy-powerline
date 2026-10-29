# Frequently asked questions

Short answers, with links to the details.

## What is agy-powerline?

A status line for Google Antigravity CLI (`agy`): a small Node.js script that agy runs on every refresh to draw the bar under its input box. It shows the model, your Gemini 5-hour and 7-day quotas with a pace marker, the Claude/GPT and Argon quotas, the context window, git and more, with themes, layouts and an editor. It is free and open source (MIT).

## How do I install it?

Run `npx agy-powerline init` with Node.js 20 or newer, then restart agy once. `init` asks for a preset, a layout and a theme, and backs up agy's `settings.json` before changing it. See [Installation details](install.md).

## Does it work on Windows?

Yes: Windows, macOS, Linux and WSL. On Windows agy runs the bar through `cmd /c`, which `init` sets up for you. For WSL, install it with a Linux Node.js inside WSL ([WSL notes](install.md#wsl)).

## Do I need to restart agy?

Once, after `init`, so agy reads the new `statusLine` setting. After that, changes you make with `configure`, `theme`, `layout` or the other commands show on the bar's next refresh, without a restart.

## Does it send any data anywhere?

No. agy-powerline makes no network requests and has no telemetry or analytics. Problems are written to a local log you can read, clear or turn off; it only leaves your computer if you attach it to an issue yourself. [Security & Privacy](../SECURITY.md) lists every file it reads and writes. Only the website, agy-powerline.com, uses Google Analytics to count visits ([Privacy](https://agy-powerline.com/privacy/)).

## Does it slow agy down?

A refresh takes about 0.1 s of agy-powerline's own work on a Windows 11 laptop. On Windows, starting `cmd` and Node adds about 0.1–0.25 s, as for any status line command. The default bar starts at most one `git` process, with a 150 ms timeout, and only when the branch is ahead of or behind its upstream. See [Performance](install.md#performance).

## Which quotas does it show?

The Gemini 5-hour and 7-day quotas, the third-party (Claude and GPT) 5-hour and 7-day quotas, and Gemini 4 Argon's weekly quota on Google AI Pro, each with its reset time. The [quota guide](guides/antigravity-quota.md) explains the meters and the pace marker.

## The bar shows boxes or question marks. How do I fix it?

Your terminal font lacks the powerline glyphs. Install a [Nerd Font](https://www.nerdfonts.com/), or turn on ASCII mode with `i` in `configure`. See [Fix broken powerline symbols](guides/nerd-font-symbols.md).

## Why does `render --demo` show widgets my live bar doesn't?

The demo uses sample data. Widgets such as `sandbox`, `artifacts` and `tasks` hide in a real session until there is a sandbox, an artifact or something running in the background. A widget with nothing to show is left out, not shown as `0` or `Unknown`.

## Can a repository I clone change my bar or run commands?

No. agy-powerline reads its config only from `~/.agy-powerline` (or the folder in `AGY_POWERLINE_HOME`), never from the current folder, and shell command widgets run only from that install. See [Guarantees around `exec` widgets](../SECURITY.md#guarantees-around-exec-widgets).

## How do I update it?

Run `npx agy-powerline init --yes`, then restart agy. Your config is kept. `npx agy-powerline doctor` tells you when the installed scripts are older than the CLI. See [Upgrading](install.md#upgrading).

## Can I install it without npm?

Yes. Each [GitHub release](https://github.com/wassim-azi/agy-powerline/releases) has the package and the agy plugin as files you can download once and install from. See [Install without npm](install.md#install-without-npm).

## How do I remove it?

`npx agy-powerline uninstall` puts agy's own bar back; add `--delete` to remove the files `init` installed. See [Uninstalling](install.md#uninstalling).

## Where do I report a bug or ask for a feature?

In [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues). For a bug, `npx agy-powerline report` writes a privacy-safe report to paste in ([Reporting a bug](troubleshooting.md#reporting-a-bug)).
