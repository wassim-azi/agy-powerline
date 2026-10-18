"use strict";

// The theme gallery is published on GitHub Pages (.github/workflows/pages.yml):
// it must be a complete page that loads nothing from other sites.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { record, ROOT, NODE } = require("../helpers");
const { THEME_ORDER } = require("../../src/lib/themes");
const themeToggle = require("../../scripts/site/theme-toggle");

const REPO_URL = "https://github.com/wassim-azi/agy-powerline";

function checkFavicon(html) {
  const match = html.match(
    /<link\s+[^>]*rel="icon"[^>]*href="(data:image\/svg\+xml;base64,([^"]+))"/
  );
  if (!match) return false;
  const decoded = Buffer.from(match[2], "base64").toString("utf8").trim();
  return decoded.startsWith("<svg") && decoded.includes("</svg>");
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-gallery-"));
  // A folder that doesn't exist yet, like _site/ on a fresh checkout.
  const out = path.join(root, "_site", "index.html");
  const out404 = path.join(root, "_site", "404.html");

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

    // Every URL in the page, compared whole: the repo link is the only one allowed.
    const urls = [...html.matchAll(/\b(?:https?:)?\/\/[^\s"'<>)]+/g)].map((match) => match[0]);
    const external = urls.filter((url) => url !== REPO_URL);
    record(
      "the gallery loads nothing from other sites (only the repo link)",
      external.length === 0 && urls.some((url) => url === REPO_URL),
      external.slice(0, 5).join(", ")
    );

    // "custom" has no colors of its own, so the gallery leaves it out.
    const missing = THEME_ORDER.filter((id) => id !== "custom" && !html.includes(`id="${id}"`));
    record("the gallery shows every built-in theme", missing.length === 0, missing.join(", "));

    record("the gallery has a base64 SVG favicon", checkFavicon(html));

    record(
      "the gallery has the shared header, relative links to Themes and Configurator, and the repo link",
      /<header class="site-header">/.test(html) &&
        /<a class="nav-link" href="\.\/" aria-current="page">Themes<\/a>/.test(html) &&
        /<a class="nav-link" href="\.\/configure\/">Configurator<\/a>/.test(html) &&
        html.includes(`href="${REPO_URL}"`) &&
        /<footer class="site-footer">/.test(html)
    );

    record(
      "the gallery links to the configurator from the hero and from every theme card",
      html.includes('href="./configure/"') && html.includes('href="./configure/#')
    );

    // 404.html check
    record("404.html builds alongside the gallery index", fs.existsSync(out404));
    if (fs.existsSync(out404)) {
      const html404 = fs.readFileSync(out404, "utf8");
      const urls404 = [...html404.matchAll(/\b(?:https?:)?\/\/[^\s"'<>)]+/g)].map(
        (match) => match[0]
      );
      const external404 = urls404.filter((url) => url !== REPO_URL);
      record(
        "404.html is a complete page with the same CSP, favicon, and links back to both pages",
        /^<!doctype html>\s*<html lang="en">\s*<head>/i.test(html404) &&
          /http-equiv="Content-Security-Policy"/.test(html404) &&
          /default-src 'none'/.test(html404) &&
          checkFavicon(html404) &&
          external404.length === 0 &&
          html404.includes('href="./"') &&
          html404.includes('href="./configure/"')
      );
    }

    // Theme toggle unit test in Node
    const storeMap = new Map();
    const fakeStorage = {
      getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
      setItem: (k, v) => storeMap.set(k, String(v)),
      removeItem: (k) => storeMap.delete(k),
    };
    const attrs = new Map();
    const buttons = ["system", "light", "dark"].map((val) => {
      const bAttrs = new Map([
        ["data-theme-value", val],
        ["aria-pressed", "false"],
      ]);
      return {
        getAttribute: (k) => bAttrs.get(k) ?? null,
        setAttribute: (k, v) => bAttrs.set(k, String(v)),
      };
    });
    const fakeDoc = {
      documentElement: {
        getAttribute: (k) => attrs.get(k) ?? null,
        setAttribute: (k, v) => attrs.set(k, String(v)),
        removeAttribute: (k) => attrs.delete(k),
      },
      querySelectorAll: () => buttons,
    };

    const initialTheme = themeToggle.readStoredTheme(fakeStorage);
    themeToggle.applyTheme("dark", fakeDoc, fakeStorage);
    const afterDark =
      themeToggle.readStoredTheme(fakeStorage) === "dark" &&
      fakeDoc.documentElement.getAttribute("data-theme") === "dark" &&
      buttons[2].getAttribute("aria-pressed") === "true" &&
      buttons[0].getAttribute("aria-pressed") === "false";

    themeToggle.applyTheme("light", fakeDoc, fakeStorage);
    const afterLight =
      themeToggle.readStoredTheme(fakeStorage) === "light" &&
      fakeDoc.documentElement.getAttribute("data-theme") === "light" &&
      buttons[1].getAttribute("aria-pressed") === "true";

    themeToggle.applyTheme("system", fakeDoc, fakeStorage);
    const afterSystem =
      themeToggle.readStoredTheme(fakeStorage) === "system" &&
      fakeDoc.documentElement.getAttribute("data-theme") === null &&
      buttons[0].getAttribute("aria-pressed") === "true";

    record(
      "the page theme toggle reads, stores and applies system, light and dark themes",
      initialTheme === "system" && afterDark && afterLight && afterSystem
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
