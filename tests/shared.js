"use strict";

// Cross-platform suites. Run with `npm run test:shared`.
const { registerSuite } = require("./register");

registerSuite("command shape", "./shared/command-shape.test");
registerSuite("renderer", "./shared/renderer.test");
registerSuite("exec cache", "./shared/exec-cache.test");
registerSuite("colors", "./shared/color.test");
registerSuite("themes", "./shared/themes.test");
registerSuite("powerline", "./shared/powerline.test");
registerSuite("quota and style", "./shared/quota-style.test");
registerSuite("fit to terminal", "./shared/fit.test");
registerSuite("widgets", "./shared/widgets.test");
registerSuite("configurator screens", "./shared/tui.test");
registerSuite("git", "./shared/git.test");
registerSuite("problem log", "./shared/log.test");
registerSuite("cli", "./shared/cli.test");
registerSuite("readme", "./shared/readme.test");
registerSuite("robustness", "./shared/robustness.test");
registerSuite("security", "./shared/security.test");
registerSuite("install safety", "./shared/install-safety.test");
registerSuite("init and doctor", "./shared/init-doctor.test");
registerSuite("snapshots", "./shared/snapshots.test");
registerSuite("commit messages", "./shared/commit-message.test");
