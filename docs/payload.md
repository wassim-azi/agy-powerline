# What Antigravity CLI sends to your status line

On every refresh, Antigravity CLI (`agy`) starts the command in `statusLine.command`, writes one JSON object to its standard input, and shows what the command prints. This page lists the fields that object actually contains, taken from real payloads of agy 1.3.0 to 1.4.0 (the anonymized files in [`tests/fixtures/`](https://github.com/wassim-azi/agy-powerline/tree/main/tests/fixtures)), with what each one means and which agy-powerline widget reads it.

- [How the payload arrives](#how-the-payload-arrives)
- [Fields](#fields)
- [Quota buckets](#quota-buckets)
- [Fields you may read about but won't see](#fields-you-may-read-about-but-wont-see)
- [Capture your own payload](#capture-your-own-payload)

## How the payload arrives

- agy runs the command on each refresh and pipes the JSON on stdin. The command prints the bar on stdout, one line per row.
- The object is sent whole every time: there are no partial updates, so a status line keeps no state between refreshes unless it caches something itself.
- Fields come and go: a field for something that isn't happening (a sandbox, a conversation title, running subagents) is often missing rather than empty. A status line should treat every field as optional.
- On Windows agy runs the command through `cmd /c`; see [Setting it up by hand](install.md#setting-it-up-by-hand) for the exact command forms.

## Fields

Seen in every payload unless the last column says otherwise. Example values are from the fixtures.

| Field                                                      | Type    | Example                          | What it is                                                              | Used by                                                 |
| ---------------------------------------------------------- | ------- | -------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `model.id`                                                 | string  | `"Gemini 3.8 Flash (High)"`      | The model in use                                                        | `model` (when `display_name` is missing)                |
| `model.display_name`                                       | string  | `"Gemini 3.8 Flash (High)"`      | The model's name as agy shows it                                        | `model`                                                 |
| `model.effort`                                             | string  | `"high"`                         | Reasoning effort; in 3 of 6 payloads                                    | (not shown)                                             |
| `version`                                                  | string  | `"1.4.0"`                        | Antigravity CLI version                                                 | `version`                                               |
| `product`                                                  | string  | `"antigravity"`                  | Product name                                                            | (not shown)                                             |
| `agent_state`                                              | string  | `"working"`                      | What the agent is doing: `idle`, `working` or `tool_use` seen           | `agentState`                                            |
| `plan_tier`                                                | string  | `"Google AI Pro"`                | The account's plan                                                      | `plan`                                                  |
| `cwd`                                                      | string  | `"/home/user/project"`           | Current folder                                                          | `cwd`, `git`                                            |
| `workspace.current_dir`                                    | string  | `"/home/user/project"`           | Current folder (same as `cwd` in every payload seen)                    | `cwd` (fallback)                                        |
| `workspace.project_dir`                                    | string  | `"/home/user/project"`           | The project's root folder                                               | `project`                                               |
| `context_window.context_window_size`                       | number  | `1048576`                        | The model's context window, in tokens                                   | `context`, `contextTokens`                              |
| `context_window.used_percentage`                           | number  | `11.74`                          | Share of the window in use, cached tokens and agy's own prompt included | `context`, `contextPct`                                 |
| `context_window.remaining_percentage`                      | number  | `88.26`                          | 100 minus `used_percentage`                                             | (not shown)                                             |
| `context_window.total_input_tokens`                        | number  | `123120`                         | Input tokens over the session                                           | `totalTokens`                                           |
| `context_window.total_output_tokens`                       | number  | `355045`                         | Output tokens over the session                                          | `totalTokens`                                           |
| `context_window.current_usage.input_tokens`                | number  | `5225`                           | Uncached input tokens of the latest request                             | `cacheHit`                                              |
| `context_window.current_usage.output_tokens`               | number  | `100`                            | Output tokens of the latest request                                     | (not shown)                                             |
| `context_window.current_usage.cache_read_input_tokens`     | number  | `113928`                         | Input tokens of the latest request served from the prompt cache         | `cacheRead`, `cacheHit`                                 |
| `context_window.current_usage.cache_creation_input_tokens` | number  | `0`                              | Tokens written to the prompt cache by the latest request                | `cacheCreate`                                           |
| `exceeds_200k_tokens`                                      | boolean | `false`                          | Whether the context is past 200K tokens                                 | context widgets (danger color)                          |
| `quota.<bucket>.remaining_fraction`                        | number  | `0.5225974`                      | Share of the bucket left, from 0 to 1                                   | quota widgets ([buckets](#quota-buckets))               |
| `quota.<bucket>.reset_time`                                | string  | `"2026-10-06T22:28:10.000Z"`     | When the bucket resets (ISO 8601, UTC)                                  | reset widgets, pace marker                              |
| `quota.<bucket>.reset_in_seconds`                          | number  | `7887`                           | Seconds until the reset                                                 | reset widgets, pace marker                              |
| `quota.<bucket>.disabled`                                  | boolean | `true`                           | The bucket doesn't apply right now; in 2 of 6 payloads                  | hides the bucket                                        |
| `vcs.type`                                                 | string  | `"git"`                          | The version control system                                              | `git`                                                   |
| `vcs.branch`                                               | string  | `"feature/login-form"`           | Branch name; in 1 of 6 payloads                                         | `git`                                                   |
| `vcs.dirty`                                                | boolean | `true`                           | Uncommitted changes; in 1 of 6 payloads                                 | `git`                                                   |
| `sandbox.enabled`                                          | boolean | `false`                          | Whether the sandbox is on                                               | `sandbox`                                               |
| `sandbox.allow_network`                                    | boolean | `true`                           | Whether the sandbox lets the network through; in 1 of 6                 | `sandbox`                                               |
| `terminal_width`                                           | number  | `188`                            | Width of agy's window, in columns                                       | row fitting, flex separators                            |
| `artifact_count`                                           | number  | `2`                              | Number of artifacts; in 2 of 6 payloads                                 | `artifacts`                                             |
| `subagents`                                                | array   | `[{ "name", "role", "status" }]` | Subagents of the conversation, finished ones included; in 3 of 6        | `tasks` (running ones; `name` and `role` of a lone one) |
| `task_count`                                               | number  | `1`                              | Background tasks running; in 2 of 6 payloads                            | `tasks`                                                 |
| `cycle_mode`                                               | string  | `"accept-edits"`                 | Approval mode, when not the default; in 2 of 6 payloads                 | `mode`                                                  |
| `vim.mode`                                                 | string  | `"INSERT"`                       | Vim mode, with Vim editing on; in 2 of 6 payloads                       | `mode`                                                  |
| `conversation_title`                                       | string  | `"hello"`                        | The conversation's title, once it has one; in 1 of 6 payloads           | `title`                                                 |
| `session_id`                                               | string  | (an ID)                          | Session ID; in 3 of 6 payloads                                          | never read                                              |
| `conversation_id`                                          | string  | (an ID)                          | Conversation ID; in 3 of 6 payloads                                     | never read                                              |
| `transcript_path`                                          | string  | (a path)                         | Path of the conversation's transcript; in 3 of 6 payloads               | never read                                              |
| `email`                                                    | string  | (an address)                     | The signed-in account's email; in 3 of 6 payloads                       | never read                                              |

agy-powerline never prints, logs or saves `email`, `session_id` or `conversation_id`, and a payload dump replaces paths and branch names with placeholders ([Security](../SECURITY.md)).

## Quota buckets

`quota` holds one object per bucket. These are the bucket names seen so far:

| Bucket                    | Window  | What it counts                                                                                                                                                                            | Widgets                                       |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `gemini-5h`               | 5 hours | Gemini models                                                                                                                                                                             | `fiveHourBar`, `fiveHourPct`, `fiveHourReset` |
| `gemini-weekly`           | 7 days  | Gemini models                                                                                                                                                                             | `weeklyBar`, `weeklyPct`, `weeklyReset`       |
| `gemini-argon-wtu-weekly` | 7 days  | Gemini 4 Argon on Google AI Pro, which has a weekly quota of its own and no 5-hour window. Sent whatever model is in use; not sent on Ultra, where Argon counts toward the Gemini buckets | `argonWeekly`, `argonReset`                   |
| `3p-5h`                   | 5 hours | Third-party models (Claude, GPT); can be `disabled`                                                                                                                                       | `thirdPartyFiveHour`                          |
| `3p-weekly`               | 7 days  | Third-party models                                                                                                                                                                        | `thirdPartyWeekly`                            |

The payload doesn't say how long a window is. agy-powerline takes 5 hours and 7 days from the bucket name, and from that and `reset_in_seconds` works out how far into the window you are: that point is the [pace marker](configuration.md#quota-pace-marker). The [quota calculator](https://agy-powerline.com/quota-calculator/) does the same sum in your browser.

## Fields you may read about but won't see

Some documentation mentions fields that have never appeared in a payload captured here:

- `cost`
- `pending_input_count`

`vcs` usually holds only `type`, without the branch or dirty state, which is why agy-powerline reads the branch, dirty state and ahead/behind counts from the `.git` folder itself.

If your payload has a field this page doesn't list, please [open an issue](https://github.com/wassim-azi/agy-powerline/issues) with a capture (below), so the page and the bar can follow.

## Capture your own payload

Set `AGY_POWERLINE_DEBUG=1` before starting agy, and the next refresh saves the payload to `~/.agy-powerline/last-payload.json`. The capture keeps only the fields the bar uses, never writes your email or session and conversation IDs, and replaces paths and the branch name with placeholders, so it is safe to attach to an issue. Details: [Capturing the payload](troubleshooting.md#capturing-the-payload).

Replay it, or any of the fixtures, to see the bar it gives:

```bash
cat ~/.agy-powerline/last-payload.json | npx agy-powerline render
```
