// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Cross-platform suites. Run with `npm run test:shared`.
// Ordered slowest-first (LPT) so parallel isolated workers finish together.
const { registerSuites } = require("./register");

registerSuites("shared", [
  ["robustness", "./shared/robustness.test"],
  ["git", "./shared/git.test"],
  ["site", "./shared/site.test"],
  ["cli", "./shared/cli.test"],
  ["init and doctor", "./shared/init-doctor.test"],
  ["install safety", "./shared/install-safety.test"],
  ["exec options", "./shared/exec-options.test", { serial: true }],
  ["fuzz", "./shared/fuzz.test"],
  ["configurator screens", "./shared/tui.test"],
  ["fit to terminal", "./shared/fit.test"],
  ["problem log", "./shared/log.test"],
  ["default command", "./shared/default-command.test"],
  ["renderer", "./shared/renderer.test"],
  ["widgets", "./shared/widgets.test"],
  ["security", "./shared/security.test"],
  ["gallery", "./shared/gallery.test"],
  ["plugin", "./shared/plugin.test"],
  ["syscalls", "./shared/syscalls.test"],
  ["session time", "./shared/session-time.test"],
  ["meters", "./shared/meters.test"],
  ["themes", "./shared/themes.test"],
  ["powerline", "./shared/powerline.test"],
  ["snapshots", "./shared/snapshots.test"],
  ["usage", "./shared/usage.test"],
  ["i18n", "./shared/i18n.test"],
  ["readme", "./shared/readme.test"],
  ["configurator", "./shared/configurator.test"],
  ["license", "./shared/license.test"],
  ["quota and style", "./shared/quota-style.test"],
  ["payload dump", "./shared/payload-dump.test"],
  ["exec cache", "./shared/exec-cache.test"],
  ["paths", "./shared/paths.test"],
  ["colors", "./shared/color.test"],
  ["command shape", "./shared/command-shape.test"],
  ["gradients", "./shared/gradient.test"],
  ["commit messages", "./shared/commit-message.test"],
]);
