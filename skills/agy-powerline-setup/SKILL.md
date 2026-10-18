---
name: agy-powerline-setup
description: Install or update the agy-powerline statusline and wire it into agy's settings. Use when the user asks to set up, install, update, fix or check agy-powerline.
---

# Set up agy-powerline

agy-powerline is a statusline for agy. These steps install it (or update it) and point agy's settings at it. Run each command with your shell tool, one at a time, and show the user what it printed.

## Steps

1. Run `node -v`. If the version is below v20, stop: tell the user to install Node.js 20 or newer from https://nodejs.org, then ask you again.
2. Run `npx -y agy-powerline@latest init --yes`. It installs the statusline in `~/.agy-powerline` and sets `statusLine` in agy's `settings.json`, after backing that file up. `--yes` answers its prompts, which you can't answer interactively.
3. Run `npx agy-powerline doctor` and sum up its result in two or three lines: whether the statusline command ran, and any problem it lists with the fix it suggests.
4. Tell the user to restart agy once (quit and start `agy` again): the bar shows after that restart.
5. Tell the user they can pick widgets, a theme and a layout with the `agy-powerline-customize` skill, or by running `npx agy-powerline configure` in their own terminal.

## Rules

- Never edit `~/.gemini/antigravity-cli/settings.json` by hand: `init` changes it safely and keeps a backup.
- Never run `npx agy-powerline configure`: it's an interactive full-screen editor and would hang your shell tool. Suggest it to the user instead.
- Never pass `--allow-exec` to `npx agy-powerline import` unless the user said yes to the exact commands `import` showed.
- If `init` fails, show its error message as printed and don't try to work around it (for example by writing files yourself). `npx agy-powerline doctor` and https://github.com/wassim-azi/agy-powerline/blob/main/docs/troubleshooting.md help with the fix.
