# Moving from Gemini CLI: customize agy's status bar

Google now points Gemini CLI users to Antigravity CLI, `agy` ([Google Developers Blog](https://developers.googleblog.com/en/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)). agy's status bar is yours to change: it runs a command you choose on every refresh. This guide sets one up that shows the model, your Gemini quotas, the context window and git, in about a minute.

- [Where agy keeps its settings](#where-agy-keeps-its-settings)
- [Set up the status bar](#set-up-the-status-bar)
- [Make it yours](#make-it-yours)
- [What you'll see](#what-youll-see)

## Where agy keeps its settings

agy keeps its settings in `~/.gemini/antigravity-cli/settings.json` (on Windows, `%USERPROFILE%\.gemini\antigravity-cli\settings.json`). The status bar is the `statusLine` entry in that file. Nothing in agy-powerline touches your other settings, and it saves a backup before every change.

## Set up the status bar

You need Node.js 20 or newer.

```bash
npx agy-powerline init
```

`init` asks three questions, each with a preview of the bar it gives: a preset (which widgets), a layout (powerline pills, plain lines or classic text) and a theme for your terminal's background. Then restart agy once.

Prefer to stay inside agy? Install agy-powerline as a plugin and run its setup skill:

```text
agy plugin install https://github.com/wassim-azi/agy-powerline
/agy-powerline-setup
```

## Make it yours

- `npx agy-powerline configure` opens an editor with a live preview: add, remove and reorder widgets, and pick presets, themes, layouts and powerline shapes.
- [Build your bar in the browser](https://agy-powerline.com/configure/), then import it with `npx agy-powerline import statusline.config.json`.
- Single changes from the command line: `npx agy-powerline theme light-paper`, `npx agy-powerline layout lines`, `npx agy-powerline preset compact`.

A running agy picks up these changes on its next refresh, without a restart.

## What you'll see

The default bar has two rows: the model, the context window and the git branch, then your 5-hour and 7-day Gemini quotas with their reset times. Each quota meter has a [pace marker](antigravity-quota.md#read-the-quota-meters) that shows whether you're using it faster than time passes.

On Google AI Pro, Gemini 4 Argon has a weekly quota of its own; add the `argonWeekly` widget to see it. If you use Claude or GPT models in agy, `thirdPartyFiveHour` and `thirdPartyWeekly` show their quotas.

Browse every theme in the [theme gallery](https://agy-powerline.com/themes/), and see the [full widget list](https://agy-powerline.com/widgets/).
