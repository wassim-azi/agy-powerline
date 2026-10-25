// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Cross-platform suites. Run with `npm run test:shared`.
const { registerSuite } = require("./register");

registerSuite("command shape", "./shared/command-shape.test");
registerSuite("paths", "./shared/paths.test");
registerSuite("renderer", "./shared/renderer.test");
registerSuite("exec cache", "./shared/exec-cache.test");
registerSuite("exec options", "./shared/exec-options.test");
registerSuite("colors", "./shared/color.test");
registerSuite("themes", "./shared/themes.test");
registerSuite("gradients", "./shared/gradient.test");
registerSuite("powerline", "./shared/powerline.test");
registerSuite("quota and style", "./shared/quota-style.test");
registerSuite("fit to terminal", "./shared/fit.test");
registerSuite("meters", "./shared/meters.test");
registerSuite("widgets", "./shared/widgets.test");
registerSuite("configurator screens", "./shared/tui.test");
registerSuite("i18n", "./shared/i18n.test");
registerSuite("git", "./shared/git.test");
registerSuite("usage", "./shared/usage.test");
registerSuite("session time", "./shared/session-time.test");
registerSuite("problem log", "./shared/log.test");
registerSuite("payload dump", "./shared/payload-dump.test");
registerSuite("cli", "./shared/cli.test");
registerSuite("readme", "./shared/readme.test");
registerSuite("gallery", "./shared/gallery.test");
registerSuite("configurator", "./shared/configurator.test");
registerSuite("site", "./shared/site.test");
registerSuite("plugin", "./shared/plugin.test");
registerSuite("robustness", "./shared/robustness.test");
registerSuite("security", "./shared/security.test");
registerSuite("fuzz", "./shared/fuzz.test");
registerSuite("install safety", "./shared/install-safety.test");
registerSuite("init and doctor", "./shared/init-doctor.test");
registerSuite("snapshots", "./shared/snapshots.test");
registerSuite("commit messages", "./shared/commit-message.test");
registerSuite("license", "./shared/license.test");
