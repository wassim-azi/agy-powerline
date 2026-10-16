# Security & Privacy Policy

This page lists exactly what `agy-powerline` does on your machine, so you can check it against the source.

---

## No network, no telemetry

- No analytics, tracking or remote crash reporting. The code makes no network requests.
- Problems are written to a local log file (below) that you can read, clear or turn off. It only leaves your machine if you attach it to an issue yourself.
- The only outbound action is opening the project's GitHub page in your browser, and only when you press `g` in `configure`.

## What runs on your machine

The statusline script Antigravity calls on each refresh reads the session JSON on `stdin` and prints one bar. While doing that it may start these processes:

| Process                                                    | When                                                                                                                                                                                                                | Why                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `git rev-list --left-right --count <branch>...@{upstream}` | The `git` widget is shown (default, and the `lines` layout) and the branch tracks an upstream (`.git/config`) whose commit differs from the local one, and that pair of commits isn't in `.git-sync-cache.json` yet | Ahead/behind counts. It runs without a shell, times out after 150 ms, and is skipped for branch names that git itself would reject. |
| Your `exec` widget commands                                | Only if **you** add an `exec` widget                                                                                                                                                                                | Runs your command through the system shell, at most once per `interval` (default 10 s), with a timeout (default 500 ms, max 5 s).   |

Everything else (branch name, dirty state, RAM, quotas, tokens) is read from files or Node.js APIs without starting a process.

The CLI itself (`npx agy-powerline ...`) additionally:

- runs your configured `statusLine` command once in `doctor`, to check it works. It runs exactly as Antigravity would run it on a refresh, so your `exec` widgets run once too;
- opens the browser as described above.

## Guarantees around `exec` widgets

- **Only your config can run commands.** `exec` widgets run only when the config comes from `~/.agy-powerline` or the folder in `AGY_POWERLINE_HOME`. A copy of the scripts anywhere else, such as one committed inside a repo, shows `[blocked]`.
- **The current directory is never used for config.** Cloning or opening a repo cannot change what agy-powerline runs.
- **Previews never execute.** `configure`, `theme`, `layout`, `preset`, `caps`, `render --demo` and the preview inside `doctor` show `[cmd]` instead of running the command. `doctor`'s live check is the one exception: it runs your configured statusline once, as Antigravity does (see above).
- **Output is cleaned.** Escape sequences and control characters are stripped and output is capped at 80 characters.

## Files it writes

| File                                                                     | Written by                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.agy-powerline/*` (scripts, `statusline.config.json`, `install.json`) | `init`, `configure` and the `theme`/`layout`/`preset`/`caps` commands                                                                                                                                                                                                                                                           |
| `~/.agy-powerline/.exec-cache.json`                                      | The runtime, only when you use `exec` widgets                                                                                                                                                                                                                                                                                   |
| `~/.agy-powerline/.git-sync-cache.json`                                  | The runtime, when a branch is ahead of or behind its upstream: the last 20 pairs of commit IDs with their ahead/behind counts, so `git` runs only when a commit moves                                                                                                                                                           |
| `~/.gemini/antigravity-cli/settings.json`                                | `init` and `uninstall`, which only change the `statusLine` key                                                                                                                                                                                                                                                                  |
| `settings.json.agy-powerline.bak`                                        | `init` and `uninstall`, a copy of the previous `settings.json`                                                                                                                                                                                                                                                                  |
| `~/.agy-powerline/agy-powerline.log`                                     | The runtime and the CLI, only when something goes wrong (crash, broken config, unreadable payload, slow refresh, `exec`/`git` timeout). No personal data: see below. Off with `"log": false` or `AGY_POWERLINE_LOG=0`.                                                                                                          |
| The file you pass to `report --output`                                   | `report`, only when you ask for it                                                                                                                                                                                                                                                                                              |
| `last-payload.json` (or the path you pass)                               | Only with `--dump-payload`, `AGY_POWERLINE_DUMP_PAYLOAD` or `AGY_POWERLINE_DEBUG`. It keeps only the fields the bar uses: no email, session or conversation IDs, subagents keep only their status (not their name or task), the conversation title only its length, and paths and the branch name are replaced by placeholders. |

On macOS and Linux, `statusline.config.json`, `.exec-cache.json`, `.git-sync-cache.json`, the problem log and the payload dump are created readable by your account only (`0600`), since they can hold your commands and their output; `init` narrows them in installs made by older versions. `settings.json` keeps the permissions it had. On Windows, your profile folder is private already.

`init` and `uninstall` refuse to rewrite a `settings.json` they cannot parse. Likewise, `configure` and the `theme`/`layout`/`preset`/`caps` commands refuse to save over a `statusline.config.json` they cannot parse, so a typo never costs you your widgets. `uninstall --delete` removes only the files listed above and never a whole directory tree.

## Your email and session IDs

Antigravity includes your account email and session and conversation IDs in the JSON it sends. agy-powerline never reads them: no widget shows them, and neither the debug dump nor the problem log writes them.

## The problem log

The log is built from an allowlist, not by filtering a full dump. Each entry holds an event code, the error type and code, the stack frames from agy-powerline's own files (as `lib/layouts/pills.js:612`), a cleaned error message, a count with first/last-seen minutes in UTC, and the agy-powerline, Node and Antigravity versions plus the platform and RAM use.

It never holds anything from the session payload except Antigravity's version number, and never a path, username, hostname, `exec` command or output, branch name, custom text or environment variable. Error messages have home folders, paths, emails, URLs, IP addresses and token-like strings removed, plus the username and hostname, and are cut at 200 characters. JSON errors keep only the line and column, since their message quotes the text that failed to parse.

`npx agy-powerline report` prints the log together with a machine summary (OS, CPU model, memory, free disk, terminal, shell name) and a setup summary (layout, theme, toggles, widget ids). It is local only; the tests check that neither the log nor the report contains the home folder, username, hostname or payload values.

## Untrusted input

Text that does not come from your own config (payload fields, branch names, command output) is stripped of terminal escape sequences before it is printed, so it cannot move the cursor, write to your clipboard (OSC 52) or insert hyperlinks.

## Supply chain

- Zero runtime dependencies.
- Releases are published from GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), so you can verify that a published version was built from this repository.
- No install scripts (`preinstall`, `install`, `postinstall`, `prepare`) in the published package; CI checks this on every change.
- The release workflow installs without a cache, so nothing from an earlier run can end up in the published package.
- GitHub Actions are pinned to exact commits, and [zizmor](https://docs.zizmor.sh/) audits the workflows on every change to them.
- Dependabot proposes a new dependency version only after it has been out for 7 days.
- [OpenSSF Scorecard](https://scorecard.dev/) checks the repository's supply-chain practices every week; results are in the repository's Security tab.

---

## Supported Versions

Only the latest release receives security fixes.

| Version | Supported          |
| :------ | :----------------- |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/wassim-azi/agy-powerline/security/advisories/new) ("Report a vulnerability"). Do not open a public issue.

Please include:

- a description of the issue;
- steps to reproduce or a proof of concept;
- affected platforms (Windows, macOS, Linux, WSL).

We aim to acknowledge reports within 48 hours and to agree on a disclosure date with you once a fix is ready.
