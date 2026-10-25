# SPDX-License-Identifier: MIT
# Copyright (c) 2026 agy-powerline contributors

# agy-powerline demo, recorded with VHS (https://github.com/charmbracelet/vhs)
# Run from the repo root, in a normal (non-Administrator) terminal:
#   vhs scripts/demo/demo.tape
# It writes assets/demo.gif.
#
# One quick take of configure, the editor with its live preview, tab by
# tab: add Gemini 4 Argon's weekly quota from the Add list by typing
# "argon", then preview a few presets, a few themes, the Lines and Classic
# layouts, and end on the Powerline tab.
#
# It starts from demo-config.json in a fresh temporary AGY_POWERLINE_HOME, so
# it never touches your real ~/.agy-powerline or agy settings. That config
# has 17 widgets and space between rows.

Output assets/demo.gif

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
Type `$env:npm_config_progress='false'; Set-PSReadLineOption -PredictionSource None; $env:AGY_POWERLINE_HOME = Join-Path ([IO.Path]::GetTempPath()) ('agy-powerline-demo-' + [Guid]::NewGuid()); New-Item -ItemType Directory $env:AGY_POWERLINE_HOME | Out-Null; Copy-Item scripts/demo/demo-config.json (Join-Path $env:AGY_POWERLINE_HOME 'statusline.config.json'); function npx { node src/index.js @($args | Select-Object -Skip 1) }; npx agy-powerline --version; function prompt { [Environment]::NewLine + '> ' }; Clear-Host`
Enter
Wait@30s
Show
Sleep 800ms

Type "npx agy-powerline configure"
Sleep 500ms
Enter
Wait+Screen@60s /Live preview/
Sleep 1.5s

# Each tab opens straight from the one before by its letter; leaving a tab
# that way applies nothing, so the widgets and theme stay.

# Widgets: the details panel follows the cursor over the first 5 widgets.
# Add (a), filtered by typing, puts Argon right after the selected one.
Down@600ms 4
Sleep 600ms
Type "a"
Sleep 600ms
Type@120ms "argon"
Sleep 1s
Enter
Sleep 1.5s

# Presets (o): the preview and the details panel follow the first 4.
Type "o"
Sleep 1s
Down@900ms 3
Sleep 1s

# Themes (t): the preview recolors over the first 5.
Type "t"
Sleep 1s
Down@700ms 4
Sleep 1s

# Layout (l): Pills, then Lines with dot meters and Classic with | dividers
# and █░│ block meters.
Type "l"
Sleep 1s
Down@1.2s 2
Sleep 1.2s

# Powerline (p): shown for a moment.
Type "p"
Sleep 1.5s
