// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Isolated child-process worker for one shared test suite. Each suite runs in
// its own OS process so env mutations, monkey-patched os/Date globals and
// module-level caches never race across parallel suites.

const { takeResults } = require("./helpers");

async function main() {
  const modulePath = process.argv[2];
  if (!modulePath) {
    throw new Error("Missing suite module path");
  }
  takeResults();
  await require(modulePath).run();
  const results = takeResults();
  if (typeof process.send === "function") {
    process.send({ results });
  }
}

main().catch((err) => {
  if (typeof process.send === "function") {
    process.send({ error: err && err.stack ? err.stack : String(err) });
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
