"use strict";

// The theme gallery is published on GitHub Pages (.github/workflows/pages.yml):
// it must be a complete page that loads nothing from other sites.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { record, ROOT, NODE } = require("../helpers");
const { THEME_ORDER } = require("../../src/lib/themes");

const REPO_URL = "https://github.com/wassim-azi/agy-powerline";

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-gallery-"));
  // A folder that doesn't exist yet, like _site/ on a fresh checkout.
  const out = path.join(root, "_site", "index.html");

  try {
    const built = spawnSync(NODE, [path.join(ROOT, "scripts", "gallery", "build.js"), out], {
      encoding: "utf8",
      windowsHide: true,
    });
    record(
      "the gallery builds into a folder that doesn't exist yet",
      built.status === 0 && fs.existsSync(out),
      built.stderr.trim()
    );
    if (!fs.existsSync(out)) {
      return;
    }

    const html = fs.readFileSync(out, "utf8");
    record(
      "the gallery is a complete page: doctype, language, charset and viewport",
      /^<!doctype html>\s*<html lang="en">\s*<head>/i.test(html) &&
        /<meta charset="utf-8"/i.test(html) &&
        /<meta name="viewport" content="width=device-width, initial-scale=1"/.test(html) &&
        /<\/body>\s*<\/html>\s*$/.test(html)
    );
    record(
      "the gallery allows only its own inline style and script",
      /http-equiv="Content-Security-Policy"/.test(html) && /default-src 'none'/.test(html)
    );

    const external = [...html.matchAll(/\b(?:https?:)?\/\/[^\s"'<>)]+/g)]
      .map((match) => match[0])
      .filter((url) => !url.startsWith(REPO_URL));
    record(
      "the gallery loads nothing from other sites (only the repo link)",
      external.length === 0 && html.includes(REPO_URL),
      external.slice(0, 5).join(", ")
    );

    // "custom" has no colors of its own, so the gallery leaves it out.
    const missing = THEME_ORDER.filter((id) => id !== "custom" && !html.includes(`id="${id}"`));
    record("the gallery shows every built-in theme", missing.length === 0, missing.join(", "));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
