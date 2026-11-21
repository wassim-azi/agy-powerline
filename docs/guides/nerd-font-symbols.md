# Fix broken powerline symbols in agy

If agy-powerline's bar shows boxes, question marks or gaps where the round caps and arrows should be, your terminal's font doesn't have the powerline glyphs. There are two fixes: use a Nerd Font in your terminal, or switch the bar to ASCII mode, which needs no special font.

- [Check what your terminal can draw](#check-what-your-terminal-can-draw)
- [Option 1: install a Nerd Font](#option-1-install-a-nerd-font)
- [Option 2: ASCII mode](#option-2-ascii-mode)
- [Emojis and wide characters](#emojis-and-wide-characters)

## Check what your terminal can draw

```bash
npx agy-powerline doctor
```

`doctor` prints a glyph test line with a powerline cap, a branch symbol and a few emojis. If some of them show as boxes, the font is missing them. `npx agy-powerline render --demo` prints a full sample bar, so you can see the result of a change right away.

## Option 1: install a Nerd Font

Nerd Fonts are programming fonts patched with the powerline glyphs and icons. Download one from [nerdfonts.com](https://www.nerdfonts.com/) (JetBrains Mono, Fira Code and Cascadia Code all have Nerd Font versions), install it, then select it in your terminal. On macOS with Homebrew: `brew install --cask font-jetbrains-mono-nerd-font`.

Select it in the terminal agy runs in:

- **Windows Terminal:** Settings → your profile (PowerShell, Command Prompt or Ubuntu) → Appearance → Font face.
- **VS Code's terminal:** set `terminal.integrated.fontFamily` to the font's name, for example `"JetBrainsMono Nerd Font"`.
- **macOS Terminal:** Settings → Profiles → Text → Font.
- **iTerm2:** Settings → Profiles → Text → Font.
- **GNOME Terminal:** Preferences → your profile → Custom font.
- **WSL:** the font belongs to the Windows terminal around it (Windows Terminal or VS Code), not to Linux, so install it on Windows.

Restart the terminal, then run `render --demo` again.

## Option 2: ASCII mode

ASCII mode draws the bar with plain characters that every font has: caps and separators become `[` `]`, `<` `>` and `/`, dot meters become `#` and `-`, and emojis turn off.

- Press `i` in `npx agy-powerline`, or
- set `"ascii": true` in `~/.agy-powerline/statusline.config.json`, or
- set the environment variable `AGY_POWERLINE_ASCII=1`.

The [browser configurator](https://agy-powerline.com/configure/) has an **ASCII Mode** switch too, with a live preview.

You can also keep a Nerd Font–free look without ASCII mode: the **flat** powerline style (`npx agy-powerline caps flat`) draws pills without round or angled caps, and the **Lines** and **Classic** layouts (`npx agy-powerline layout lines`) use no powerline glyphs at all.

## Emojis and wide characters

Widget icons are emojis. If they show as boxes or push the bar out of line, your terminal's emoji support is the cause, not the font. Turn icons off via **Emojis** in the Settings tab (`i`) in `npx agy-powerline` (or `"emojis": false`), or turn on **Minimalist mode** there to show values only. More on colors, narrow windows and ASCII mode: [Terminals](../configuration.md#terminals-ascii-mode-colors-narrow-windows).
