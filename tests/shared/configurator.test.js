"use strict";

// The web configurator runs entirely in the browser on GitHub Pages.
// It must build cleanly, load with zero external network requests,
// render every widget in an isolated sandbox, and round-trip configs.

const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("node:vm");
const { spawnSync } = require("child_process");
const { record, ROOT, NODE } = require("../helpers");
const { THEME_ORDER } = require("../../src/lib/themes");
const { WIDGET_CATALOG } = require("../../src/lib/catalog");
const { defaultConfig } = require("../../src/lib/shared");
const { buildBrowserBundle } = require("../../scripts/configurator/bundle");
const page = require("../../scripts/configurator/page");

const REPO_URL = "https://github.com/wassim-azi/agy-powerline";

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-verify-configurator-"));
  const out = path.join(root, "_site", "configure", "index.html");

  try {
    const built = spawnSync(NODE, [path.join(ROOT, "scripts", "configurator", "build.js"), out], {
      encoding: "utf8",
      windowsHide: true,
    });
    record(
      "the configurator builds into a folder that doesn't exist yet",
      built.status === 0 && fs.existsSync(out),
      built.stderr.trim()
    );
    if (!fs.existsSync(out)) {
      return;
    }

    const html = fs.readFileSync(out, "utf8");
    record(
      "the configurator is a complete page: doctype, language, charset and viewport",
      /^<!doctype html>\s*<html lang="en">\s*<head>/i.test(html) &&
        /<meta charset="utf-8"/i.test(html) &&
        /<meta name="viewport" content="width=device-width, initial-scale=1"/.test(html) &&
        /<\/body>\s*<\/html>\s*$/.test(html)
    );

    record(
      "the configurator allows only its own inline style and script",
      /http-equiv="Content-Security-Policy"/.test(html) && /default-src 'none'/.test(html)
    );

    const urls = [...html.matchAll(/\b(?:https?:)?\/\/[^\s"'<>)]+/g)].map((match) => match[0]);
    const external = urls.filter((url) => url !== REPO_URL);
    record(
      "the configurator loads nothing from other sites (only the repo link)",
      external.length === 0 && urls.some((url) => url === REPO_URL),
      external.slice(0, 5).join(", ")
    );

    const missingThemes = THEME_ORDER.filter((id) => !html.includes(`value="${id}"`));
    record(
      "the configurator page contains every theme id",
      missingThemes.length === 0,
      missingThemes.join(", ")
    );

    const missingWidgets = WIDGET_CATALOG.filter((w) => !html.includes(`data-id="${w.id}"`));
    record(
      "the configurator page contains every widget id",
      missingWidgets.length === 0,
      missingWidgets.map((w) => w.id).join(", ")
    );

    // Config round-trip through URL hash
    const initial = defaultConfig();
    const hash = page.encodeConfig(initial);
    const decoded = page.decodeConfig(hash);
    record(
      "a config round-trips through the URL hash",
      JSON.stringify(initial) === JSON.stringify(decoded)
    );

    // Pasted config validation
    const current = { ...initial, theme: "dark-ocean" };
    const invalidResult = page.loadPastedConfig("not json at all { {", current);
    record(
      "pasted invalid JSON shows an error and changes nothing",
      invalidResult.ok === false &&
        Boolean(invalidResult.error) &&
        invalidResult.config.theme === "dark-ocean"
    );

    const validWithExtras = JSON.stringify({
      theme: "light-paper",
      unknownSetting: 123,
      widgets: [{ id: "model" }, { id: "nonExistentWidget" }],
    });
    const validResult = page.loadPastedConfig(validWithExtras, current);
    record(
      "pasted config merges cleanly and lists dropped settings",
      validResult.ok === true &&
        validResult.config.theme === "light-paper" &&
        validResult.dropped.some((d) => d.includes("unknownSetting")) &&
        validResult.dropped.some((d) => d.includes("nonExistentWidget"))
    );

    // Share link length checking
    const shareNormal = page.buildShareUrl(initial, "https://example.com/configure/");
    record(
      "share link generates URL with base64url hash",
      shareNormal.url.startsWith("https://example.com/configure/#") && !shareNormal.tooLong
    );

    const bigConfig = {
      ...initial,
      widgets: Array.from({ length: 150 }, () => ({
        id: "customText",
        text: "Long custom text widget badge",
      })),
    };
    const shareBig = page.buildShareUrl(bigConfig, "https://example.com/configure/");
    record(
      "share link exceeding 2000 characters is flagged as too long",
      shareBig.tooLong === true && shareBig.length > 2000
    );

    // Isolated VM check: no real Node module reachable
    const bundleCode = buildBrowserBundle();
    const sandbox = {
      console,
    };
    const context = vm.createContext(sandbox);
    vm.runInContext(bundleCode, context);
    const Agy = sandbox.AgyConfigurator || sandbox.globalThis.AgyConfigurator;

    const data = Agy.sampleData();
    let allRendered = true;
    let failedWidget = null;
    for (const item of Agy.WIDGET_CATALOG) {
      try {
        const res = Agy.renderStatusline(data, {
          ...Agy.defaultConfig(),
          widgets: [{ id: item.id }],
        });
        if (typeof res !== "string" || !res.length) {
          allRendered = false;
          failedWidget = item.id;
          break;
        }
      } catch (err) {
        allRendered = false;
        failedWidget = `${item.id}: ${err.message}`;
        break;
      }
    }

    record(
      "browser bundle loads in Node with only shims and renders every widget id with sampleData()",
      Boolean(Agy) && allRendered,
      failedWidget
    );

    // Widget operations
    let widgets = [{ id: "model" }, { id: "git" }];
    widgets = page.addWidget(widgets, "sessionTime", 0);
    const addedOk = widgets.length === 3 && widgets[1].id === "sessionTime";
    widgets = page.moveWidget(widgets, 1, 0);
    const movedOk = widgets[0].id === "sessionTime";
    widgets = page.removeWidget(widgets, 0);
    const removedOk = widgets.length === 2 && widgets[0].id === "model";
    widgets = page.updateWidget(widgets, 0, { short: true });
    const updatedOk = widgets[0].short === true;

    record(
      "widget manipulation functions add, move, remove and update widgets correctly",
      addedOk && movedOk && removedOk && updatedOk
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = { run };
