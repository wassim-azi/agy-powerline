<!-- Pull requests target `main` and are squash-merged; the PR title becomes the commit message. -->

## Description

Briefly describe the change and why it was made. If it fixes an open issue, link it using `Fixes #...`.

---

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (new widget, theme, layout option)
- [ ] 🎨 UI / Theme styling change
- [ ] ⚡ Performance improvement
- [ ] 📝 Documentation update
- [ ] 🧪 Tests / CI improvement

---

## Verification & Checklist

Before submitting this PR, please make sure:

- [ ] All tests pass locally: `npm test`
- [ ] Lint and formatting pass: `npm run lint` and `npm run format:check`
- [ ] If the bar's output changed on purpose, snapshots are updated (`npm run test:update`) and the diff in `tests/snapshots/` matches the change
- [ ] If a theme changed, its contrast and status-color tests still pass (part of `npm test`)
- [ ] If terminal output changed, tested with `--ascii` (verified pure ASCII rendering)
- [ ] If colors were modified, verified in truecolor and `--color 256` / `--color none`
- [ ] `CHANGELOG.md` has an entry for every user-visible change (see CONTRIBUTING.md → Changelog)
- [ ] No runtime `dependencies` added (tools go in `devDependencies`)
- [ ] Attached screenshot or terminal recording (for visual changes)
