# Contributing to agy-powerline

First off, thank you for considering contributing to **agy-powerline**! 🎉

This document explains how to set up the development environment, the architecture of the project, how to add new widgets and themes, and how to verify your changes.

---

Using an AI coding agent (Antigravity CLI, Claude Code, Codex, Cursor, Copilot, ...)? It picks up [AGENTS.md](AGENTS.md), which gives it the commands, rules and workflow below in condensed form.

## 🛠️ Quickstart & Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/wassim-azi/agy-powerline.git
   cd agy-powerline
   git checkout develop
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

   This also turns on the repo's git hooks (`.githooks/`): before each commit, Prettier and ESLint check your staged files, and your commit message is checked against the rules below. If a hook stops you, it tells you the command that fixes it.

3. **Run the checks CI runs:**

   ```bash
   npm test              # all tests
   npm run lint          # ESLint
   npm run format:check  # Prettier (npm run format fixes it)
   ```

4. **Test live rendering locally:**

   ```bash
   # Render demo data in pills layout:
   node src/index.js render --demo

   # Render demo data in ASCII mode:
   node src/index.js render --demo --ascii

   # Test with custom JSON input:
   cat tests/fixtures/antigravity-1.3.0.json | node src/index.js render
   ```

5. **Run system diagnostics:**
   ```bash
   node src/index.js doctor
   ```

### 🔄 Seeing Your Changes in Live Antigravity

Antigravity executes the runtime scripts installed in `~/.agy-powerline/`. If you are modifying files in `src/` and want to test them inside your real Antigravity prompt:

- **Quick Sync**:

  ```bash
  node src/index.js init --yes
  ```

  _(Until you do, Antigravity keeps running the copy installed in `~/.agy-powerline/`, not your changes in `src/`.)_

- **Direct Repo Link (Zero re-init)**:
  Inside Antigravity, point the statusline directly to your development repository:
  ```text
  /statusline node <abs-path-to-repo>/src/index.js
  ```

### 💡 Contextual / Auto-Hiding Widgets

Keep in mind that widgets such as `sandbox` and `artifacts` **auto-hide when inactive or count is 0** to keep the terminal prompt clean and distraction-free.

To test these states locally without waiting for real Antigravity session triggers, feed the sample fixtures. Both use Antigravity's real payload format: `antigravity-1.3.0.json` is a cleaned capture from agy 1.3.0, and `antigravity-near-limits.json` is the same payload edited to low quotas, a 91% context, an active sandbox and a dirty branch.

```bash
# A real session payload:
cat tests/fixtures/antigravity-1.3.0.json | node src/index.js render

# Low quotas, high context, sandbox and a dirty branch:
cat tests/fixtures/antigravity-near-limits.json | node src/index.js render
```

---

## 🏗️ Architecture Overview

The codebase is organized into small, focused modules without heavy frameworks or unnecessary abstractions:

```
agy-powerline/
├── src/
│   ├── index.js              # CLI entry point (Node's built-in util.parseArgs)
│   ├── cli/                  # One file per command (init, configure, theme, gradient, layout,
│   │                         # preset, caps, export, import, doctor, report, uninstall), bundle.js
│   │                         # (the one-file installed runtime), tui-style.js and config-guard.js
│   ├── lib/
│   │   ├── shared.js         # renderStatusline(), the rendering entry point
│   │   ├── session.js        # Extracts & normalizes fields from Antigravity's JSON payload
│   │   ├── catalog.js        # Widget ids, labels, descriptions and summaries
│   │   ├── config.js         # Configuration loading, validation, defaults and presets
│   │   ├── widget-style.js   # Each widget's icon and label (WIDGET_TAGS), colors, raw and pace options
│   │   ├── fit.js            # Keeps rows within the terminal width (DROP_ORDER)
│   │   ├── colors.js         # Truecolor / 256 / NO_COLOR ANSI escape sequences
│   │   ├── themes.js         # Built-in themes (dark-*, light-*, colorblind-*)
│   │   ├── powerline.js      # Caps, separators and powerline styles
│   │   ├── formatters.js     # Text helpers, sanitizing (stripControl, sanitizeDeep)
│   │   ├── git.js            # Branch, dirty state and ahead/behind, with a timeout
│   │   ├── exec.js           # The exec (shell command) widget
│   │   ├── log.js            # Local problem log
│   │   ├── payload-dump.js   # Privacy-safe payload dumps for bug reports
│   │   ├── mock-data.js      # Sample payload for render --demo and the configure preview
│   │   ├── paths.js          # Cross-platform paths, safe settings writes, RUNTIME_FILES
│   │   ├── run.js, prompt.js # Command runner for doctor; yes/no prompts
│   │   └── layouts/
│   │       ├── pills.js      # Powerline capsule layout
│   │       └── lines.js      # Colored-text layout with 25-dot meters
│   └── runtime/
│       └── statusline.js     # Runtime script executed by Antigravity on every refresh; init
│                             # joins it with RUNTIME_FILES into one installed statusline.js
├── docs/                     # User docs beyond the README: configuration, install, troubleshooting
├── tests/
│   ├── shared.js             # node:test entry for the cross-platform suites
│   ├── platform.js           # node:test entry for the current OS's launcher suite
│   ├── register.js           # Turns each suite's record() checks into node:test subtests
│   ├── update-snapshots.js   # Rewrites tests/snapshots/ (npm run test:update)
│   ├── fixtures/             # Sample Antigravity JSON payloads
│   ├── snapshots/            # Expected bar output, one file per input
│   ├── shared/               # Cross-platform rendering & configuration tests
│   └── platform/             # Windows / macOS / Linux launcher tests
└── scripts/
    ├── gallery/              # npm run gallery / screenshots: previews of every theme
    ├── hooks/                # Git hooks: pre-commit (Prettier, ESLint), commit-msg
    └── release/              # Plugin archives attached to each GitHub release
```

---

## 🧩 How to Add a New Widget (5 Steps)

Adding a widget to `agy-powerline` takes 5 straightforward steps:

### 1. Register the widget in the Catalog

In `src/lib/catalog.js`, add your widget definition to `WIDGET_CATALOG`:

```javascript
{
  id: "my_widget",
  label: "My Widget",
  unique: true,
  description: "one sentence for the configure details panel",
  summary: "six words at most",
},
```

`summary` is what the configure lists show next to the label, so keep it to six words; `description` is the full sentence in the details panel.

### 2. Whitelist the widget ID and give it a drop rank

In `src/lib/config.js`, add `"my_widget"` to the `VALID_WIDGET_IDS` set:

```javascript
const VALID_WIDGET_IDS = new Set([
  // ...
  "my_widget",
]);
```

In `src/lib/fit.js`, add it to `DROP_ORDER`. On a narrow terminal, widgets earlier in that list are hidden first, so place it by how much users would miss it. A test fails if a catalog widget is missing there.

### 3. Implement the Widget Renderer in both layouts

Read any new payload field in `src/lib/session.js` (as a number or sanitized text, never raw), give the widget its icon and label in `WIDGET_TAGS` (`src/lib/widget-style.js`), then add a `case` in **both** layouts. Both layouts take the icon and label from that table, so they read the same. Return `null` when there is nothing to show, so the widget hides.

In `src/lib/widget-style.js`:

```javascript
const WIDGET_TAGS = {
  // ...
  my_widget: { icon: "🏷️", name: "Mine" },
};
```

In `src/lib/layouts/pills.js`, inside `buildSegment`:

```javascript
case "my_widget":
  if (!session.myProperty) {
    return null;
  }
  return pill(colors.meta, lbl(session.myProperty));
```

In `src/lib/layouts/lines.js`, inside `buildLinesSegment`:

```javascript
case "my_widget":
  if (!session.myProperty) {
    return null;
  }
  return fg(palette.text) + tag() + session.myProperty + RESET;
```

### 4. Add Unit Tests

In `tests/shared/renderer.test.js`, add an assertion verifying that your widget renders properly:

```javascript
const output = renderStatusline(
  { ...sampleData(), myProperty: "test-value" },
  { ...defaultConfig(), widgets: [{ id: "my_widget" }] }
);
record("Pills layout renders my_widget", /test-value/.test(output));
```

Run `npm test` to ensure it passes, then `npm run test:update` if the bar's output changed on purpose.

### 5. Document it

Add the widget to the widget table in `README.md` (and the same row in every translation, `README.<lang>.md`; a description in English is fine if you don't speak the language) and to the Widgets list in `docs/configuration.md`, and add a `CHANGELOG.md` entry. The `readme` test suite fails if a README misses the widget.

---

## 🎨 How to Add a New Theme

Themes live in **one file** (`src/lib/themes.js`).

1. Add the theme to `THEMES` and `THEME_ORDER`. The id starts with its kind (`dark-`, `light-` or `colorblind-`):
   ```javascript
   "dark-example": theme("dark", "Dark Example", "One-line description", {
     text: DARK_TEXT, track: "#4b4b4b",
     model: "#c586c0", fiveHour: "#73c991", weekly: "#9cdcfe",
     thirdParty: "#ce9178", context: "#569cd6", git: "#4ec9b0", gitDirty: "#e2c08d",
     meta: "#cccccc", caution: "#cca700", warn: "#f48771",
   }),
   ```
   Dark themes use bright colors with `DARK_TEXT`; light themes use deep colors with `LIGHT_TEXT` (white).
2. Run `npm test`. The theme tests check that every color reaches 4.5:1 contrast against the pill text and the terminal background, and that `fiveHour` (ok), `caution` and `warn` (danger) are clearly different. Color-blind themes must also pass simulated protanopia, deuteranopia and tritanopia.
3. Look at it with `node src/index.js theme --gallery` on a terminal of the matching background.
4. Add it to the themes table in `README.md` and in every translation (`README.<lang>.md`); the `readme` test suite fails if one misses it.

---

## 🧪 Testing Guidelines

Every change must keep the bar cross-platform and fast:

1. **Cross-Platform Compatibility:**
   - Must run cleanly on Linux, macOS, Windows cmd, Windows PowerShell, and WSL.
   - Run tests using:
     ```bash
     npm test               # Full suite (node:test)
     npm run test:shared    # Cross-platform suites
     npm run test:platform  # Native OS launcher tests
     npm run test:coverage  # Shared suites with a coverage report

     # Run one suite by name:
     node --test --test-name-pattern=snapshots tests/shared.js
     ```

2. **ASCII & Color Degradation:**
   - Always verify that `--ascii` emits zero non-ASCII characters (caps, joins, or emojis).
   - Test that `--color none` emits zero ANSI color codes.

3. **Snapshots:**
   - `tests/snapshots/` holds the exact output of the bar for a set of inputs, layouts and themes, with escape codes written as readable tags such as `{fg #c4a7ff}`.
   - If your change alters the output on purpose, run `npm run test:update` and check that the snapshot diff shows only what you meant to change. Commit the updated files with your PR.
   - If a snapshot test fails and you didn't mean to change the output, that's a regression.

4. **Visual Check:**
   - `npm run gallery` writes `gallery.html` with every theme rendered on dark and light terminals, plus a color-blindness simulation. Open it in a browser.
   - `npm run screenshots` writes one SVG per theme to `screenshots/`, with the pills and lines layouts on the theme's terminal background.
   - CI builds both for every pull request: open the run's Summary page and download the `theme-preview` artifact.

5. **Zero Runtime Dependencies:**
   - The published package has no `dependencies` at all, and CI fails if one is added. Use Node.js built-ins (`util.parseArgs`, `readline`, `fs`, ...) instead of npm packages.
   - Development tools (linting, formatting) go in `devDependencies`, which users never install.

---

## 🐛 Fixing a Bug from a Report

1. Ask the reporter for the output of `npx agy-powerline report` (system info, setup summary and the local problem log, with no personal data) and, for rendering problems, the payload captured with `AGY_POWERLINE_DEBUG=1` (saved to `~/.agy-powerline/last-payload.json`).
2. Save the payload as `tests/fixtures/<short-name>.json`. Dumps from `AGY_POWERLINE_DEBUG` are already free of personal data; a payload pasted by hand may not be, so replace `email`, `session_id`, `conversation_id` and any paths with neutral values first.
3. Reproduce: `node src/index.js render < tests/fixtures/<short-name>.json`.
4. Fix the bug, then run `npm run test:update`. The new fixture gets its own snapshot file, which locks the fix in.
5. Open the PR against `develop` and link the issue with `Fixes #<number>`.

---

## 📝 Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/). The first line is `<type>(<optional scope>): <description>`, at most 100 characters:

- `feat(widget): add battery status indicator`
- `fix(windows): escape launcher path with spaces`
- `docs: update screenshot in README`
- `test: add high-context fixture tests`
- `refactor: simplify session normalization`
- `feat(config)!: rename theme ids` (`!` marks a breaking change)

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

The `commit-msg` hook checks this locally. CI checks every commit in your PR and the PR title too, so `--no-verify` only postpones the error. To check a range yourself: `npm run lint:commits -- origin/develop..HEAD`.

Pull requests are **squash-merged**: your PR becomes one commit on `develop`, and the PR title is its message. Give the PR a title that describes the whole change.

---

## 📒 Changelog

- **Every user-visible change gets a `CHANGELOG.md` entry in the same PR** (new feature, behavior change, bug fix, security fix, removed option). Skip it only for changes users can't notice: tests, CI, refactors, typo fixes in docs.
  - Entries go under `## [Unreleased]` at the top of the file; create that section if it's missing. Never add entries to a version that's already released: a change belongs to the first release tag that contains it (`git tag --contains <commit>`).
  - One line per change, written for users, under the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) heading that fits (`### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Security`), ending with the issue or PR number when there is one, e.g. `- Battery widget shows charging state (#42)`. The release notes are written from these lines.
- Don't change `version` in `package.json`; the maintainer sets it at release time.
- **Credits are the maintainer's job.** When your PR is merged, the maintainer adds `thanks @you` to its changelog line and adds you to the contributors table in the READMEs. Leave the table and `.all-contributorsrc` as they are in your PR (a new README translation copies the table and adds its file name to `files` in `.all-contributorsrc`).

At release time the maintainer renames `## [Unreleased]` to the new version and date.

---

## 🌿 Branches

| Branch    | What it is                                                 | Who changes it                                              |
| --------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `develop` | Where all work lands. Open your pull requests here.        | Anyone, through a reviewed pull request                     |
| `main`    | Released code. Every npm release is published from `main`. | Only the maintainer, by fast-forwarding `main` to `develop` |

History is linear on both branches: no merge commits. A pull request into `main` from any other branch or author fails a required CI check and can't be merged. If you opened one by mistake, change its base branch to `develop` ("Edit" next to the PR title).

---

## 🚀 Submitting a Pull Request

1. Pick an issue, for example one labelled [good first issue](https://github.com/wassim-azi/agy-powerline/labels/good%20first%20issue). Read its comments and the open pull requests first, and pick another one if someone has already claimed it; then comment on it before you start, so two people don't do the same work. One issue per pull request.
2. Fork the repo and create your branch from `develop`:
   ```bash
   git checkout develop
   git checkout -b feat/my-new-feature
   ```
3. Make your changes and write tests.
4. Verify that `npm test` passes with 100% success.
5. Rebase on the latest `develop`, push your branch and open a Pull Request against **`develop`** (not `main`). Push later fixes to the same pull request.
6. Attach a screenshot or terminal capture for visual changes!

Bugs go in [GitHub issues](https://github.com/wassim-azi/agy-powerline/issues) (with the output of `npx agy-powerline report`); questions and ideas go in [Discussions](https://github.com/wassim-azi/agy-powerline/discussions).
