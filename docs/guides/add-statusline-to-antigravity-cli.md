# How to add a status line to Antigravity CLI

Antigravity CLI (`agy`) can run a command of your choice to draw its status bar. You set it under `statusLine` in `~/.gemini/antigravity-cli/settings.json`; agy runs it on every refresh, pipes the session as JSON on its standard input, and shows what it prints. The quickest way to set one up is `npx agy-powerline`, then one restart of agy.

- [The one-command setup](#the-one-command-setup)
- [The statusLine setting](#the-statusline-setting)
- [What the command receives](#what-the-command-receives)
- [Write your own status line](#write-your-own-status-line)
- [Check that it works](#check-that-it-works)

## The one-command setup

You need Node.js 20 or newer and agy.

```bash
npx agy-powerline
```

It copies the status line script to `~/.agy-powerline`, adds the `statusLine` entry to agy's `settings.json`, and opens the live-preview editor so you can pick a preset, a layout and a theme. It asks before replacing anything and keeps a backup of `settings.json`. Restart agy once so it reads the new setting. [What setup does](../install.md#what-init-does) covers every step.

From inside agy you can also install agy-powerline as a plugin and let its setup skill run `init` for you ([Install from inside agy](../install.md#install-from-inside-agy-plugin)).

## The statusLine setting

`statusLine` takes a `type` of `command` and the `command` to run (plus optional `enabled`, `padding`, and `stack_with_default`). Antigravity expands a leading `~` in `command`, though full paths remain safest across shells and Windows `cmd /c`.

```json
{
  "statusLine": {
    "type": "command",
    "command": "'/usr/bin/node' '/home/you/.agy-powerline/statusline.js'"
  }
}
```

- **macOS and Linux:** the command runs through `sh -c`, so quote paths that may contain spaces.
- **Windows:** agy runs the command through `cmd /c`. Point it at a `.cmd` file and don't put quotes around the path: `"command": "C:/Users/you/.agy-powerline/statusline.cmd"`.
- **Inside agy:** `/statusline <command>` sets it, `/statusline` (or `on`/`enable`, `off`/`disable`) toggles it, and `/statusline delete` (or `/statusline reset`) goes back to the built-in bar.

`init` can also keep agy's own bar and draw below it (`--stack`), or leave blank lines above (`--padding <n>`). The exact commands for each system are in [Setting it up by hand](../install.md#setting-it-up-by-hand).

## What the command receives

On every refresh the command gets one JSON object on stdin: the model, the context window, quotas, the folder, the agent's state, the terminal width and more. For example:

```json
{
  "model": { "id": "Gemini 3.8 Flash (High)", "display_name": "Gemini 3.8 Flash (High)" },
  "context_window": { "context_window_size": 1048576, "used_percentage": 10.42 },
  "quota": {
    "gemini-5h": { "remaining_fraction": 0.979, "reset_in_seconds": 17042 }
  },
  "terminal_width": 198
}
```

Every field seen so far, with types and examples, is in the [payload reference](../payload.md).

## Write your own status line

Any program that reads stdin and prints text works. A minimal one in Node.js:

```js
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const data = JSON.parse(input || "{}");
  const left = data.quota?.["gemini-5h"]?.remaining_fraction;
  const quota = typeof left === "number" ? ` · 5h ${Math.round(left * 100)}% left` : "";
  console.log(`${data.model?.display_name ?? "agy"}${quota}`);
});
```

Things to plan for, since agy runs it on every refresh:

- **Treat every field as optional.** A field for something that isn't happening is often missing rather than empty.
- **Exit quickly and never crash.** Print something short (or nothing) on bad input instead of a stack trace.
- **Don't print raw text from the payload.** Branch names and titles can contain terminal control characters; strip them first.
- **Keep it fast.** A status line that starts other programs on every refresh slows agy down; cache what you can.

agy-powerline does all of this, with themes, layouts and an editor, if you'd rather not write your own.

## Check that it works

```bash
npx agy-powerline doctor
```

`doctor` checks the install, runs the configured command with sample JSON and shows its output and timing. To see a bar without agy, run `npx agy-powerline render --demo`. If the bar doesn't show up, see [Troubleshooting](../troubleshooting.md).
