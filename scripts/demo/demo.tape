# SPDX-License-Identifier: MIT
# Copyright (c) 2026 agy-powerline contributors

# agy-powerline demo, recorded with VHS (https://github.com/charmbracelet/vhs)
# Run from the repo root, in a normal (non-Administrator) terminal:
#   vhs scripts/demo/demo.tape
# It writes assets/demo.gif for the READMEs, and the same take as video
# (assets/site/demo/editor.mp4 and .webm, with its last frame as
# editor-poster.png) for the home page of agy-powerline.com. The poster loads
# with the page, so give it a 256-color palette afterwards (530 KB down to 200 KB):
#   ffmpeg -i assets/site/demo/editor-poster.png -vf "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none" -pred mixed -compression_level 9 poster.png
# then move poster.png over editor-poster.png.
#
# One quick take of configure, the editor with its live preview, tab by
# tab: add Gemini 4 Argon's reset timer from the Add list by typing
# "argon", preview presets, browse and filter themes with "/", step through
# Classic, Pills, and Lines layouts, and finish on Meter style in Settings.
#
# It starts from demo-config.json in a fresh temporary AGY_POWERLINE_HOME, so
# it never touches your real ~/.agy-powerline or agy settings. That config
# has 16 widgets on 3 rows, in the Classic layout and the dark-mono theme,
# and no bar-wide meterStyle: one would draw every layout's meters the same
# way, so the Layout tab couldn't show each layout's own look.

Output assets/demo.gif
Output assets/site/demo/editor.mp4
Output assets/site/demo/editor.webm

# About 178 columns by 42 rows, the size of a maximized terminal: wide
# enough (140 or more) for configure's details panel beside each list.
Set Shell "pwsh"
Set FontFamily "JetBrains Mono"
Set FontSize 18
Set LineHeight 1.2
Set Width 2180
Set Height 1300
Set Padding 24
Set Margin 0
Set BorderRadius 10
Set WindowBar "Colorful"
Set WindowBarSize 36
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms
Set PlaybackSpeed 1.0
# At 30 fps VHS drops frames on Windows and the GIF plays too fast.
Set Framerate 15

# Off camera:
# - A short prompt, no npm progress spinner and no PSReadLine suggestions.
# - "npx agy-powerline" runs this working copy (node src/index.js), so the
#   GIF shows the next release before it's on npm.
# - One warm-up run, so configure opens quickly on camera.
Hide
Type `$env:npm_config_progress='false'; Set-PSReadLineOption -PredictionSource None; $d = Join-Path ([IO.Path]::GetTempPath()) ('agy-powerline-demo-' + [Guid]::NewGuid()); $env:HOME = $d; $env:USERPROFILE = $d; $env:AGY_POWERLINE_HOME = Join-Path $d '.agy-powerline'; New-Item -ItemType Directory $env:AGY_POWERLINE_HOME | Out-Null; Copy-Item scripts/demo/demo-config.json (Join-Path $env:AGY_POWERLINE_HOME 'statusline.config.json'); function npx { node src/index.js @($args | Select-Object -Skip 1) }; npx agy-powerline --version; function prompt { [Environment]::NewLine + '> ' }; Clear-Host`
Enter
Wait@30s
Show
Sleep 800ms

Type "npx agy-powerline"
Sleep 500ms
Enter
Wait+Screen@60s /Live preview/
Sleep 1.5s

# Each tab opens straight from the one before by its letter; leaving a tab
# that way applies nothing, so the widgets and theme stay.

# Widgets: the details panel follows the cursor over the first 3 rows, then
# Up wraps around to Argon 7d, the last widget. Add (a), filtered by typing,
# offers only Argon's reset timer (Argon 7d is one per bar and already in)
# and puts it right after the selected widget.
Down@600ms 2
Sleep 600ms
Up@500ms 3
Sleep 600ms
Type "a"
Sleep 600ms
Type@120ms "argon"
Sleep 1s
Enter
Sleep 1.5s

# Presets (o): the preview and the details panel follow the first 3.
Type "o"
Sleep 900ms
Down@800ms 2
Sleep 900ms

# Themes (t): browse themes, then filter with "/".
Type "t"
Sleep 900ms
Down@600ms 2
Sleep 500ms
Type "/"
Sleep 300ms
Type@100ms "tokyo"
Sleep 900ms
Escape
Sleep 500ms

# Layout (l): opens on Classic, this config's layout, with | dividers and
# block meters, then Pills and Lines.
Type "l"
Sleep 900ms
Down@1s 2
Sleep 1s

# Settings (i): end on Meter style, previewing the 9 meter styles.
Type "i"
Sleep 800ms
Down@400ms 4
Sleep 2.5s
Screenshot assets/site/demo/editor-poster.png
