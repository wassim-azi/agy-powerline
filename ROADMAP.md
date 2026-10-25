# Roadmap

What agy-powerline plans for the year to October 2027. Plans can change; the [issues](https://github.com/wassim-azi/agy-powerline/issues) labelled `enhancement` are the up-to-date list, and [Discussions](https://github.com/wassim-azi/agy-powerline/discussions) is the place to suggest something.

## Planned

### Features

- **Quota run-out forecast** on `fiveHourPct`, `weeklyPct` and `quota`: when you run out at your current pace, e.g. "at this pace you run out at 15:40".
- **Pace delta** on the same widgets: how far ahead of or behind a sustainable pace you are, e.g. `⇡15%` faster than sustainable or `⇣10%` of headroom.
- **Subagents in `tasks`**: the running subagent's name and role, from the `subagents` field agy already sends.
- **Themes named after their palettes**, so they're easy to find: `dark-dracula`, `dark-tokyo-night` and `dark-catppuccin-macchiato` (the current ids keep working), and the other Catppuccin flavors (Latte, Frappé, Mocha), each passing the contrast tests.
- **Font check in `init`**: a sample pill and the question "Do these shapes look right?", which turns on ASCII mode when your terminal font lacks the Powerline symbols.
- **Bar labels in more languages**: Japanese ([#147](https://github.com/wassim-azi/agy-powerline/issues/147)), Korean ([#150](https://github.com/wassim-azi/agy-powerline/issues/150)) and Simplified Chinese ([#122](https://github.com/wassim-azi/agy-powerline/issues/122)), each reviewed by a native or fluent speaker.
- **Clickable folder and branch links** (OSC 8 hyperlinks) in terminals that support them ([#101](https://github.com/wassim-azi/agy-powerline/issues/101)).

### Reliability and contributors

- **Keeping up with agy**: support for new fields in the session JSON as new agy versions send them, each tested against a captured payload in `tests/fixtures/`.
- **`exec` timeouts end the whole command**: a command that runs past its timeout is stopped with everything it started, on Windows too.
- **One module per widget**: today a widget touches eight files; one module rendered by both layouts makes adding a widget a one-file pull request.
- **Security practices**: the OpenSSF Best Practices Silver badge, and a second maintainer so that every change gets a review by someone other than its author.

## Not planned

These stay out, because they would break the [hard rules](AGENTS.md#hard-rules) that protect users' machines:

- runtime dependencies;
- network calls or telemetry;
- reading config from the current directory.
