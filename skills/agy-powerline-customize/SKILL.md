---
name: agy-powerline-customize
description: Change how the agy-powerline statusline looks, with its theme, preset, layout, cap style and gradient commands, or save and load its config. Use when the user asks to change, restyle, simplify or share their agy-powerline bar.
---

# Customize agy-powerline

Each command below changes `~/.agy-powerline/statusline.config.json` and prints a preview of the bar. agy shows the change on its next refresh, without a restart. Run the commands with your shell tool.

Always list first, then apply, then show the user the preview the command printed.

If npx can't download the package (a network, proxy or registry error), run the same command with `node <home>/.gemini/config/plugins/agy-powerline/src/index.js` in place of `npx agy-powerline`, with the user's home directory written out, when that file exists.

| The user asks for                                      | List                                            | Apply                                   |
| ------------------------------------------------------ | ----------------------------------------------- | --------------------------------------- |
| Another look or colors ("make it light", "dark theme") | `npx agy-powerline theme --list`                | `npx agy-powerline theme <id>`          |
| Other widgets ("only one line", "show all quotas")     | `npx agy-powerline preset --list`               | `npx agy-powerline preset <id>`         |
| Plain text instead of pills, or the other way round    | `npx agy-powerline layout --list`               | `npx agy-powerline layout <id>`         |
| Rounder, sharper or flat pill ends                     | `npx agy-powerline caps --list`                 | `npx agy-powerline caps <style>`        |
| A gradient across each row ("add a gradient")          | `npx agy-powerline gradient --list`             | `npx agy-powerline gradient <name>`     |
| Back up or share the config                            | `npx agy-powerline export`                      | `npx agy-powerline export <file>`       |
| Load a config from a file                              | (read the file and tell the user what it holds) | `npx agy-powerline import <file> --yes` |

- `theme` also takes `dark`, `light` and `colorblind`. `gradient off` removes a gradient.
- `preset` replaces the widget list; theme and layout stay.
- `import` shows what changes before applying. Pass `--merge` to change only the settings in the file.
- For anything the commands don't cover (one widget's color, thresholds, a widget of its own), point the user to `npx agy-powerline configure` in their own terminal, or to https://github.com/wassim-azi/agy-powerline/blob/main/docs/configuration.md.

## Rules

- Never edit `~/.gemini/antigravity-cli/settings.json` by hand.
- Never run `npx agy-powerline configure`: it's an interactive full-screen editor and would hang your shell tool. Suggest it to the user instead.
- Never pass `--allow-exec` to `npx agy-powerline import` unless the user said yes to the exact commands `import` showed. A file that adds shell commands runs them on every refresh.
