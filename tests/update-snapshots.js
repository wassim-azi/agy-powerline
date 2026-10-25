// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Rewrites tests/snapshots/*.txt from the current renderer output.
// Run after an intended change to what the bar prints, then review the diff.
const { run } = require("./shared/snapshots.test");
const { takeResults } = require("./helpers");

run({ update: true }).then(() => {
  const written = takeResults().length;
  console.log(
    `Updated ${written} snapshot file(s) in tests/snapshots/. Review the diff before committing.`
  );
});
