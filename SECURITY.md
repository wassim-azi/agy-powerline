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

## The website

[agy-powerline.com](https://agy-powerline.com/) is a static site built from this repo (`scripts/site/`) and served by GitHub Pages. Its pages load nothing from other sites (a Content Security Policy allows only the scripts each page was built with, named by their hash; the configurator's script is a file on the site whose content its integrity hash pins, the site's own stylesheet and inline styles, and images and the Inter font served from the site itself), set no cookies and run no analytics. The browser configurator and the quota calculator work in your browser and send nothing; the only thing a page stores is your System / Light / Dark choice, in your browser's local storage. Details: [Privacy](https://agy-powerline.com/privacy/).

After each deploy, the Pages workflow (`.github/workflows/pages.yml`) sends the site's page addresses to IndexNow (`api.indexnow.org`), so search engines that use it see changed pages sooner. That runs in GitHub Actions, sends only those public addresses, and is not part of the package.

## Guarantees around `exec` widgets

- **Only your config can run commands.** `exec` widgets run only when the config comes from `~/.agy-powerline` or the folder in `AGY_POWERLINE_HOME`. A copy of the scripts anywhere else, such as one committed inside a repo, shows `[blocked]`.
- **The current directory is never used for config.** Cloning or opening a repo cannot change what agy-powerline runs.
- **Previews never execute.** `configure`, `theme`, `gradient`, `layout`, `preset`, `caps`, `import`, `render --demo` and the preview inside `doctor` show `[cmd]` instead of running the command. `doctor`'s live check is the one exception: it runs your configured statusline once, as Antigravity does (see above).
- **Imported commands are shown first.** `import` prints every `exec` command a file would add, in full and with control characters shown as ``-style escapes, and adds them only after their own confirmation (default No) or with `--allow-exec`; `--yes` alone doesn't accept them, and without a terminal to ask in, the import is refused.
- **Output is cleaned.** Escape sequences and control characters are stripped and output is capped at 80 visible characters. With `"colors": true`, color and style sequences (SGR, `ESC [ … m`) are kept; titles, clipboard writes, hyperlinks, cursor movement and screen clearing are still removed.

## Files it reads

Besides its own config, the session JSON and the `.git` folder of your project, the statusline reads agy's conversations folder, and only with the `tokensToday`, `tokensWeek` or `sessionTime` widget on the bar:

- `~/.gemini/antigravity-cli/conversations/*.db`, agy's conversation databases, opened read-only by `tokensToday` and `tokensWeek`. Only these fields are read: the token counts (input, output), the response, provider message and message IDs (to count a response once) and timestamps. Never a message, prompt, title, model name or file name. Nothing from them is printed, logged or cached except the token totals per day. Previews never open them.
- With `sessionTime`, the folder is listed and the creation and modification times of each `.db` file (and of its `.db-wal`) are read, at most once a minute. It never opens a database. The file names are used only to read those times: never printed, logged or cached. Previews never list the folder.

## Files it writes

| File                                                                     | Written by                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~/.agy-powerline/*` (scripts, `statusline.config.json`, `install.json`) | `init`, `configure`, `import` and the `theme`/`gradient`/`layout`/`preset`/`caps` commands                                                                                                                                                                                                                                      |
| `~/.agy-powerline/.exec-cache.json`                                      | The runtime, only when you use `exec` widgets                                                                                                                                                                                                                                                                                   |
| `~/.agy-powerline/.git-sync-cache.json`                                  | The runtime, when a branch is ahead of or behind its upstream: the last 20 pairs of commit IDs with their ahead/behind counts, so `git` runs only when a commit moves                                                                                                                                                           |
| `~/.agy-powerline/.git-status-cache.json`                                | The runtime, only with the `gitFiles` or `gitChanges` widget: the last 20 repository paths and commit IDs with their file and line counts, so `git` runs at most once every 5 seconds per repository                                                                                                                            |
| `~/.agy-powerline/.usage-cache.json`                                     | The runtime, only with the `tokensToday` or `tokensWeek` widget: input and output tokens per day for each recent conversation database, keyed by a hash of its path (no path, name or conversation ID), with its size and time, so a database is read again only when it changes                                                |
| `~/.agy-powerline/.session-cache.json`                                   | The runtime, only with the `sessionTime` widget: the start and last-activity times of the active conversation and when the folder was last listed (three timestamps, no file name or conversation ID), so the folder is listed at most once a minute                                                                            |
| `~/.gemini/antigravity-cli/settings.json`                                | `init` and `uninstall`, which only change the `statusLine` key. A symlinked `settings.json` stays a link: the change goes into the file it points to                                                                                                                                                                            |
| `settings.json.agy-powerline.bak`                                        | `init` and `uninstall`, a copy of the previous `settings.json`, replaced on every change                                                                                                                                                                                                                                        |
| `settings.json.agy-powerline.original.bak`                               | `init` and `uninstall`, once: your `settings.json` as it was before agy-powerline first changed it; never replaced                                                                                                                                                                                                              |
| `~/.agy-powerline/agy-powerline.log`                                     | The runtime and the CLI, only when something goes wrong (crash, broken config, unreadable payload, slow refresh, `exec`/`git` timeout). No personal data: see below. Off with `"log": false` or `AGY_POWERLINE_LOG=0`.                                                                                                          |
| The file you pass to `report --output`                                   | `report`, only when you ask for it                                                                                                                                                                                                                                                                                              |
| The file you pass to `export`                                            | `export`, only when you name a file; it refuses to replace an existing one without `--force`                                                                                                                                                                                                                                    |
| `~/.agy-powerline/statusline.config.json.bak`                            | `import`: your config as it was before the last import, replaced on every import                                                                                                                                                                                                                                                |
| `last-payload.json` (or the path you pass)                               | Only with `--dump-payload`, `AGY_POWERLINE_DUMP_PAYLOAD` or `AGY_POWERLINE_DEBUG`. It keeps only the fields the bar uses: no email, session or conversation IDs, subagents keep only their status (not their name or task), the conversation title only its length, and paths and the branch name are replaced by placeholders. |

On macOS and Linux, `statusline.config.json`, its `.bak`, `.exec-cache.json`, `.git-sync-cache.json`, `.git-status-cache.json`, `.usage-cache.json`, `.session-cache.json`, the problem log, a file written by `export` and the payload dump are created readable by your account only (`0600`), since they can hold your commands and their output; `init` narrows them in installs made by older versions. `settings.json` keeps the permissions it had. On Windows, your profile folder is private already.

`init` and `uninstall` refuse to rewrite a `settings.json` they cannot parse. Likewise, `configure`, `import` and the `theme`/`gradient`/`layout`/`preset`/`caps` commands refuse to save over a `statusline.config.json` they cannot parse, so a typo never costs you your widgets. `uninstall --delete` removes only the files listed above and never a whole directory tree.

## Your email and session IDs

Antigravity includes your account email and session and conversation IDs in the JSON it sends. agy-powerline never reads those payload fields: no widget shows them, neither the debug dump nor the problem log writes them, and they are removed from the session JSON before an `exec` widget with `"payload": true` gets it. The `sessionTime` widget uses conversation filenames only to stat files and never compares, prints, logs or caches them.

## The problem log

The log is built from an allowlist, not by filtering a full dump. Each entry holds an event code, the error type and code, the stack frames from agy-powerline's own files (as `lib/layouts/pills.js:612`), a cleaned error message, a count with first/last-seen minutes in UTC, and the agy-powerline, Node and Antigravity versions plus the platform and RAM use.

It never holds anything from the session payload except Antigravity's version number, and never a path, username, hostname, `exec` command or output, branch name, custom text or environment variable. Error messages have home folders, paths, emails, URLs, IP addresses and token-like strings removed, plus the username and hostname, and are cut at 200 characters. JSON errors keep only the line and column, since their message quotes the text that failed to parse.

`npx agy-powerline report` prints the log together with a machine summary (OS, CPU model, memory, free disk, terminal, shell name) and a setup summary (layout, theme, toggles, widget ids). It is local only; the tests check that neither the log nor the report contains the home folder, username, hostname or payload values.

## Untrusted input

Text that does not come from your own config (payload fields, branch names, command output) is stripped of terminal escape sequences before it is printed, so it cannot move the cursor, write to your clipboard (OSC 52) or insert hyperlinks. The one exception you can opt into is color in the output of your own `exec` commands (`"colors": true`), which keeps only color and style sequences.

## Supply chain

- Zero runtime dependencies.
- Releases are published from GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), so you can verify that a published version was built from this repository.
- Each GitHub release has the npm tarball attached (`agy-powerline-<version>.tgz`, the same file that's on npm) and the plugin archives (`agy-powerline-plugin-<version>.tar.gz` and `.zip`, for installing without npm), each with its signed build attestation (`<file>.sigstore.json`), plus their SLSA provenance in one file (`agy-powerline-<version>.intoto.jsonl`). To check a downloaded file: `gh attestation verify <file> -R wassim-azi/agy-powerline`, adding `--bundle <file>.sigstore.json`.
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

### What happens next

1. The maintainer confirms the issue in the private advisory, or explains why it isn't one.
2. The fix is developed in the advisory's private fork, with a test that fails without it, and released as a new version. Fixes for issues rated medium or higher ship within 60 days of the report, and sooner for critical ones.
3. The advisory is published with the release, with a CVE requested through GitHub, and the release's `CHANGELOG.md` entry goes under `### Security`.
4. You are credited by name or GitHub handle in the advisory and the changelog, unless you ask to stay anonymous.

## Assurance case

Why the measures above are enough for what agy-powerline does.

**Threat model.** agy-powerline runs as your user on every refresh of agy, and its CLI writes your config and agy's `settings.json`. What could go wrong: a repository you open, or text from agy, makes it run a command, rewrite your terminal or leak data; a config file someone shares with you runs a command; a broken refresh hangs or crashes agy's bar; a write loses your settings; or a tampered package reaches npm.

**Trust boundaries.** Trusted: your config in `~/.agy-powerline` (or `AGY_POWERLINE_HOME`) and the commands you put in it. Untrusted: the session JSON agy sends, everything inside the project you work in (its `.git` folder, its config, branch names), the output of commands, and files passed to `import`. Between the repository and the npm package, GitHub Actions is the only path, with the checks under _Supply chain_.

**Secure design principles applied.**

- Least privilege: no network access, no shell except for the commands you configure, workflows start from no permissions and get them per job.
- Fail-safe defaults: `exec` runs only from the trusted install folder, previews never run commands, imported commands are refused unless you confirm them.
- Economy of mechanism: zero runtime dependencies and one bundled runtime file.
- Complete mediation: every untrusted string goes through the same cleaning functions (`stripControl`, `sanitizeDeep`) before it is printed.
- Separation of privilege: a release needs a tag on `main` and the maintainer's approval, and the job that writes to the release is separate from the one that runs npm and the tests.
- Open design: all of this is in the source and in this file.

**Common weaknesses countered.**

| Weakness                                             | Countered by                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OS command injection (CWE-78)                        | agy-powerline's own processes start with an argument array and no shell; only commands you configure (`exec` widgets, and your `statusLine` in `doctor`) use one. Branch names git would reject never reach `git`. |
| Terminal escape injection (CWE-150)                  | Escape and control characters are stripped from untrusted text before it's printed.                                                                                                                                |
| Uncontrolled search path (CWE-427)                   | Config is never read from the current directory; git commands that would start programs named in a repository's own `.git/config` are skipped.                                                                     |
| Sensitive data in logs (CWE-532)                     | The problem log is built from an allowlist and redacts paths, names and tokens; private files are created `0600`.                                                                                                  |
| Loss of user data                                    | `settings.json` and the config are never overwritten when they can't be parsed, and a backup is kept.                                                                                                              |
| Resource exhaustion and hangs (CWE-400)              | Every process the statusline starts has a timeout, and the runtime exits quickly on any input.                                                                                                                     |
| Untrusted dependencies and build tampering (CWE-829) | No runtime dependencies, actions pinned to commits, signed provenance for each release.                                                                                                                            |

The tests check these properties on every change (the `security`, `robustness` and `install safety` suites, among others), and CodeQL and OpenSSF Scorecard scan the repository. The latest security review and its findings are in [SECURITY-REVIEW.md](SECURITY-REVIEW.md).
