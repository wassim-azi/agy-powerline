# Workshop: customize agy in 30 minutes

A ready-to-run session for a meetup, a student group or a team: everyone ends up with an agy status bar they chose, and understands how agy talks to it. Free to use and adapt; no slides needed. Each step lists what to say, what to run and what people should see.

**You need:** Antigravity CLI (`agy`) and Node.js 20 or newer on each laptop, and a terminal. Windows, macOS, Linux and WSL all work.

- [Before the session (5 minutes)](#before-the-session-5-minutes)
- [1. How agy's status bar works (5 minutes)](#1-how-agys-status-bar-works-5-minutes)
- [2. Install a status bar (5 minutes)](#2-install-a-status-bar-5-minutes)
- [3. Read your quotas (5 minutes)](#3-read-your-quotas-5-minutes)
- [4. Make it yours (10 minutes)](#4-make-it-yours-10-minutes)
- [5. Wrap up (5 minutes)](#5-wrap-up-5-minutes)

## Before the session (5 minutes)

Ask everyone to check that `agy` starts and that Node.js is recent enough:

```bash
node -v    # 20 or newer
```

If a terminal shows boxes instead of symbols later on, point people to [Fix broken powerline symbols](nerd-font-symbols.md) or have them turn on ASCII mode.

## 1. How agy's status bar works (5 minutes)

**Say:** agy runs a command of your choice on every refresh, sends it the session as JSON on standard input, and shows what it prints. The command is set under `statusLine` in `~/.gemini/antigravity-cli/settings.json`.

**Run**, to see a bar drawn from sample data, without installing anything:

```bash
npx agy-powerline render --demo
```

**Show** the [payload reference](../payload.md): model, context window, quotas, folder, agent state, terminal width.

## 2. Install a status bar (5 minutes)

**Run:**

```bash
npx agy-powerline
```

It installs the status bar and opens a live-preview editor where everyone picks a preset, a layout and a theme. Then everyone restarts agy and sends it a message, to see the bar under the input box.

**If it doesn't show:** `npx agy-powerline doctor` checks the install and says what's wrong.

## 3. Read your quotas (5 minutes)

**Say:** the second row shows the 5-hour and 7-day quotas. The light dots fill as you use quota; the larger dot is the pace marker, where you are in the window. Fill past the marker means the quota runs out before it resets at this rate.

**Try:** the [quota pace calculator](https://agy-powerline.com/quota-calculator/) with the numbers from your own bar. Then [See your Antigravity quota while you work](antigravity-quota.md) for the details.

## 4. Make it yours (10 minutes)

**Run:**

```bash
npx agy-powerline
```

Ideas to try, with the live preview:

- Add the `clock` or `title` widget (`a` to add, type to search).
- Switch to the `quotas` preset (`o`), then back.
- Try a light theme (`t`), the Lines layout (`l`) and the slanted powerline style (`p`).
- Make the weekly quota appear only when it gets low: `showBelow` in [Alerts and thresholds](../configuration.md#alerts-and-thresholds).

Prefer a browser? The [configurator](https://agy-powerline.com/configure/) builds the same config; `npx agy-powerline import statusline.config.json` applies it. Share bars by exporting them: `npx agy-powerline export my-bar.json`.

## 5. Wrap up (5 minutes)

- Show two or three people's bars on the projector.
- `npx agy-powerline uninstall` puts agy's own bar back for anyone who wants it.
- To write your own status line instead, start from [How to add a status line to Antigravity CLI](add-statusline-to-antigravity-cli.md#write-your-own-status-line).

Questions and ideas go to [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues).
