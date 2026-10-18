# Security & Privacy Policy

This page lists exactly what `agy-powerline` does on your machine, so you can check it against the source.

---

## No network, no telemetry

- No analytics, tracking or remote crash reporting. The code makes no network requests.
- Problems are written to a local log file (below) that you can read, clear or turn off. It only leaves your machine if you attach it to an issue yourself.
- The only outbound action is opening the project's GitHub page in your browser, and only when you press `g` in `configure`.

## What runs on your machine

The statusline script Antigravity calls on each refresh reads the session JSON on `stdin` and prints one bar. While doing that it may start these processes:

| Process                                                            | When                                                                                                                                                                                                                | Why                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git rev-list --left-right --count <branch>...<branch>@{upstream}` | The `git` widget is shown (default, and the `lines` layout) and the branch tracks an upstream (`.git/config`) whose commit differs from the local one, and that pair of commits isn't in `.git-sync-cache.json` yet | Ahead/behind counts. It runs without a shell, times out after 150 ms, and is skipped for branch names that git itself would reject.                                                                                                                                                                                          |
| `git status --porcelain=v2`                                        | Only if you add the `gitFiles` widget, at most once every 5 seconds per repository and commit (`.git-status-cache.json`)                                                                                            | File counts. Without a shell, with a 300 ms timeout, `--no-optional-locks` (never takes the index lock), `core.fsmonitor=false` and submodules skipped. Not run at all in a repository whose own `.git/config` sets `fsmonitor`, a `filter`, a `diff` driver or an `include`, since git would start the programs those name. |
| `git diff --shortstat HEAD`                                        | Only if you add the `gitChanges` widget, on the same terms as `git status` above                                                                                                                                    | Line counts, with external diff drivers and textconv turned off as well.                                                                                                                                                                                                                                                     |
| Your `exec` widget commands                                        | Only if **you** add an `exec` widget                                                                                                                                                                                | Runs your command through the system shell, at most once per `interval` (default 10 s), with a timeout (default 500 ms, max 5 s). Its stdin is empty, or with `"payload": true` the session JSON without your email and session and conversation IDs.                                                                        |

Everything else (branch name, dirty state, a rebase or merge in progress, commit ID, stashes, worktree, RAM, quotas, tokens) is read from files or Node.js APIs without starting a process; with `gitFiles` on the bar, the dirty state also uses its `git status` result.

The agy plugin's skills (`agy plugin install https://github.com/wassim-azi/agy-powerline`) are instructions for agy's agent, not code: they run `node -v` and `npx agy-powerline …` commands through agy's shell tool, which asks you first. `npx` downloads agy-powerline from npm, the same as the install in the README; agy-powerline itself still makes no network calls.

The CLI itself (`npx agy-powerline ...`) additionally:

- runs your configured `statusLine` command once in `doctor`, to check it works. It runs exactly as Antigravity would run it on a refresh, so your `exec` widgets run once too;
- opens the browser as described above.

## Guarantees around `exec` widgets

- **Only your config can run commands.** `exec` widgets run only when the config comes from `~/.agy-powerline` or the folder in `AGY_POWERLINE_HOME`. A copy of the scripts anywhere else, such as one committed inside a repo, shows `[blocked]`.
- **The current directory is never used for config.** Cloning or opening a repo cannot change what agy-powerline runs.
- **Previews never execute.** `configure`, `theme`, `gradient`, `layout`, `preset`, `caps`, `import`, `render --demo` and the preview inside `doctor` show `[cmd]` instead of running the command. `doctor`'s live check is the one exception: it runs your configured statusline once, as Antigravity does (see above).
- **Imported commands are shown first.** `import` prints every `exec` command a file would add, in full and with control characters shown as ``-style escapes, and adds them only after their own confirmation (default No) or with `--allow-exec`; `--yes` alone doesn't accept them, and without a terminal to ask in, the import is refused.
- **Output is cleaned.** Escape sequences and control characters are stripped and output is capped at 80 visible characters. With `"colors": true`, color and style sequences (SGR, `ESC [ … m`) are kept; titles, clipboard writes, hyperlinks, cursor movement and screen clearing are still removed.

## Files it reads

Besides its own config, the session JSON and the `.git` folder of your project, the statusline reads one more thing, and only with the `tokensToday` or `tokensWeek` widget on the bar:

- `~/.gemini/antigravity-cli/conversations/*.db`, agy's conversation databases, opened read-only. Only these fields are read: the token counts (input, output), the response, provider message and message IDs (to count a response once) and timestamps. Never a message, prompt, title, model name or file name. Nothing from them is printed, logged or cached except the token totals per day. Previews never open them.

## Files it writes

| File                                                                     | Written by                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.agy-powerline/*` (scripts, `statusline.config.json`, `install.json`) | `init`, `configure`, `import` and the `theme`/`gradient`/`layout`/`preset`/`caps` commands                                                                                                                                                                                                                                      |
| `~/.agy-powerline/.exec-cache.json`                                      | The runtime, only when you use `exec` widgets                                                                                                                                                                                                                                                                                   |
| `~/.agy-powerline/.git-sync-cache.json`                                  | The runtime, when a branch is ahead of or behind its upstream: the last 20 pairs of commit IDs with their ahead/behind counts, so `git` runs only when a commit moves                                                                                                                                                           |
| `~/.agy-powerline/.git-status-cache.json`                                | The runtime, only with the `gitFiles` or `gitChanges` widget: the last 20 repository paths and commit IDs with their file and line counts, so `git` runs at most once every 5 seconds per repository                                                                                                                            |
| `~/.agy-powerline/.usage-cache.json`                                     | The runtime, only with the `tokensToday` or `tokensWeek` widget: input and output tokens per day for each recent conversation database, keyed by a hash of its path (no path, name or conversation ID), with its size and time, so a database is read again only when it changes                                                |
| `~/.gemini/antigravity-cli/settings.json`                                | `init` and `uninstall`, which only change the `statusLine` key. A symlinked `settings.json` stays a link: the change goes into the file it points to                                                                                                                                                                            |
| `settings.json.agy-powerline.bak`                                        | `init` and `uninstall`, a copy of the previous `settings.json`, replaced on every change                                                                                                                                                                                                                                        |
| `settings.json.agy-powerline.original.bak`                               | `init` and `uninstall`, once: your `settings.json` as it was before agy-powerline first changed it; never replaced                                                                                                                                                                                                              |
| `~/.agy-powerline/agy-powerline.log`                                     | The runtime and the CLI, only when something goes wrong (crash, broken config, unreadable payload, slow refresh, `exec`/`git` timeout). No personal data: see below. Off with `"log": false` or `AGY_POWERLINE_LOG=0`.                                                                                                          |
| The file you pass to `report --output`                                   | `report`, only when you ask for it                                                                                                                                                                                                                                                                                              |
| The file you pass to `export`                                            | `export`, only when you name a file; it refuses to replace an existing one without `--force`                                                                                                                                                                                                                                    |
| `~/.agy-powerline/statusline.config.json.bak`                            | `import`: your config as it was before the last import, replaced on every import                                                                                                                                                                                                                                                |
| `last-payload.json` (or the path you pass)                               | Only with `--dump-payload`, `AGY_POWERLINE_DUMP_PAYLOAD` or `AGY_POWERLINE_DEBUG`. It keeps only the fields the bar uses: no email, session or conversation IDs, subagents keep only their status (not their name or task), the conversation title only its length, and paths and the branch name are replaced by placeholders. |

On macOS and Linux, `statusline.config.json`, its `.bak`, `.exec-cache.json`, `.git-sync-cache.json`, `.git-status-cache.json`, `.usage-cache.json`, the problem log, a file written by `export` and the payload dump are created readable by your account only (`0600`), since they can hold your commands and their output; `init` narrows them in installs made by older versions. `settings.json` keeps the permissions it had. On Windows, your profile folder is private already.

`init` and `uninstall` refuse to rewrite a `settings.json` they cannot parse. Likewise, `configure`, `import` and the `theme`/`gradient`/`layout`/`preset`/`caps` commands refuse to save over a `statusline.config.json` they cannot parse, so a typo never costs you your widgets. `uninstall --delete` removes only the files listed above and never a whole directory tree.

## Your email and session IDs

Antigravity includes your account email and session and conversation IDs in the JSON it sends. agy-powerline never reads them: no widget shows them, neither the debug dump nor the problem log writes them, and they are removed from the session JSON before an `exec` widget with `"payload": true` gets it.

## The problem log

The log is built from an allowlist, not by filtering a full dump. Each entry holds an event code, the error type and code, the stack frames from agy-powerline's own files (as `lib/layouts/pills.js:612`), a cleaned error message, a count with first/last-seen minutes in UTC, and the agy-powerline, Node and Antigravity versions plus the platform and RAM use.

It never holds anything from the session payload except Antigravity's version number, and never a path, username, hostname, `exec` command or output, branch name, custom text or environment variable. Error messages have home folders, paths, emails, URLs, IP addresses and token-like strings removed, plus the username and hostname, and are cut at 200 characters. JSON errors keep only the line and column, since their message quotes the text that failed to parse.

`npx agy-powerline report` prints the log together with a machine summary (OS, CPU model, memory, free disk, terminal, shell name) and a setup summary (layout, theme, toggles, widget ids). It is local only; the tests check that neither the log nor the report contains the home folder, username, hostname or payload values.

## Untrusted input

Text that does not come from your own config (payload fields, branch names, command output) is stripped of terminal escape sequences before it is printed, so it cannot move the cursor, write to your clipboard (OSC 52) or insert hyperlinks. The one exception you can opt into is color in the output of your own `exec` commands (`"colors": true`), which keeps only color and style sequences.

## Supply chain

- Zero runtime dependencies.
- Releases are published from GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), so you can verify that a published version was built from this repository.
- Each GitHub release has the npm tarball attached (`agy-powerline-<version>.tgz`, the same file that's on npm) with its signed build attestation (`agy-powerline-<version>.tgz.sigstore.json`). To check a downloaded tarball: `gh attestation verify agy-powerline-<version>.tgz -R wassim-azi/agy-powerline`, adding `--bundle agy-powerline-<version>.tgz.sigstore.json`.
- Publishing uses npm trusted publishing (OIDC): no npm token is stored in the repository. Each release needs the maintainer's approval in a protected GitHub environment and is refused unless its tag is on `main`; release tags can't be created, moved or deleted outside that process.
- Secret scanning with push protection blocks commits that contain credentials.
- No install scripts (`preinstall`, `install`, `postinstall`, `prepare`) in the published package; CI checks this on every change.
- The release workflow installs without a cache, so nothing from an earlier run can end up in the published package.
- GitHub Actions are pinned to exact commits, and [zizmor](https://docs.zizmor.sh/) audits the workflows on every change to them, with [actionlint](https://github.com/rhysd/actionlint) checking that they're valid.
- Dependabot proposes a new dependency version only after it has been out for 7 days.
- [OpenSSF Scorecard](https://scorecard.dev/) checks the repository's supply-chain practices every week; results are in the repository's Security tab.

---

## Supported Versions

Only the latest release receives security fixes.

| Version             | Supported                                        |
| :------------------ | :----------------------------------------------- |
| Latest release      | :white_check_mark:                               |
| Any earlier release | :x: (update with `npx agy-powerline init --yes`) |

---

## Reporting a Vulnerability

Please report vulnerabilities privately through [GitHub Security Advisories](https://github.com/wassim-azi/agy-powerline/security/advisories/new) ("Report a vulnerability"). Do not open a public issue.

Please include:

- a description of the issue;
- steps to reproduce or a proof of concept;
- affected platforms (Windows, macOS, Linux, WSL).

We aim to acknowledge reports within 48 hours and to agree on a disclosure date with you once a fix is ready.
