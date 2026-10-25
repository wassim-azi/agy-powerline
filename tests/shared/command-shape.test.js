// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { record } = require("../helpers");
const { statuslineCommand, quoteForSh } = require("../../src/lib/paths");

async function run() {
  const win = statuslineCommand("/Users/me/.agy-powerline", { platform: "win32" });
  record(
    "win32 command has no embedded quotes",
    !win.includes('"') && /statusline\.cmd$/.test(win),
    win
  );

  const unixHome = "/home/you/.agy-powerline";
  const unix = statuslineCommand(unixHome, {
    platform: "linux",
    execPath: "/usr/bin/node",
  });
  record(
    "linux command is single-quoted node + script",
    unix === "'/usr/bin/node' '/home/you/.agy-powerline/statusline.js'",
    unix
  );

  const mac = statuslineCommand("/Users/you/.agy-powerline", {
    platform: "darwin",
    execPath: "/opt/homebrew/bin/node",
  });
  record(
    "darwin command is single-quoted node + script",
    mac === "'/opt/homebrew/bin/node' '/Users/you/.agy-powerline/statusline.js'",
    mac
  );

  const spaced = statuslineCommand("/Users/John Doe/.agy-powerline", {
    platform: "linux",
    execPath: "/usr/bin/node",
  });
  record(
    "linux command quotes spaces in the install path",
    spaced.includes("'/Users/John Doe/.agy-powerline/statusline.js'"),
    spaced
  );

  const quoted = quoteForSh("/opt/homebrew/bin/node");
  record(
    "quoteForSh wraps a simple path in single quotes",
    quoted === "'/opt/homebrew/bin/node'",
    quoted
  );

  const singleQuoteEscaped = quoteForSh("/path/with'quote");
  record(
    "quoteForSh safely escapes internal single quotes",
    singleQuoteEscaped === "'/path/with'\\''quote'",
    singleQuoteEscaped
  );
}

module.exports = { run };
