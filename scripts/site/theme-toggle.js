"use strict";

/*
 * Shared page theme controller (dark / light / system) for the GitHub Pages site.
 * Callable in Node (for unit tests) and in the browser.
 */

const STORAGE_KEY = "agy-powerline-theme";
const VALID_THEMES = ["system", "light", "dark"];

function normalizeTheme(value) {
  if (value === "light" || value === "dark") {
    return value;
  }
  return "system";
}

function readStoredTheme(storage) {
  const store =
    storage !== undefined
      ? storage
      : typeof globalThis !== "undefined" && globalThis.localStorage
        ? globalThis.localStorage
        : null;
  if (!store || typeof store.getItem !== "function") {
    return "system";
  }
  try {
    return normalizeTheme(store.getItem(STORAGE_KEY));
  } catch {
    return "system";
  }
}

function storeTheme(theme, storage) {
  const normalized = normalizeTheme(theme);
  const store =
    storage !== undefined
      ? storage
      : typeof globalThis !== "undefined" && globalThis.localStorage
        ? globalThis.localStorage
        : null;
  if (!store) {
    return normalized;
  }
  try {
    if (normalized === "system") {
      if (typeof store.removeItem === "function") {
        store.removeItem(STORAGE_KEY);
      }
    } else if (typeof store.setItem === "function") {
      store.setItem(STORAGE_KEY, normalized);
    }
  } catch {
    /* Storage may be blocked or disabled in private browsing */
  }
  return normalized;
}

function applyTheme(theme, doc, storage) {
  const normalized = normalizeTheme(theme);
  if (storage !== undefined) {
    storeTheme(normalized, storage);
  }
  const targetDoc =
    doc !== undefined
      ? doc
      : typeof globalThis !== "undefined" && globalThis.document
        ? globalThis.document
        : null;
  if (targetDoc && targetDoc.documentElement) {
    if (normalized === "light" || normalized === "dark") {
      targetDoc.documentElement.setAttribute("data-theme", normalized);
    } else if (typeof targetDoc.documentElement.removeAttribute === "function") {
      targetDoc.documentElement.removeAttribute("data-theme");
    }
  }
  if (targetDoc && typeof targetDoc.querySelectorAll === "function") {
    const buttons = targetDoc.querySelectorAll("[data-theme-value]");
    for (const btn of buttons) {
      const active = btn.getAttribute("data-theme-value") === normalized;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }
  return normalized;
}

function initThemeToggle(doc, storage) {
  const targetDoc =
    doc !== undefined
      ? doc
      : typeof globalThis !== "undefined" && globalThis.document
        ? globalThis.document
        : null;
  const store =
    storage !== undefined
      ? storage
      : typeof globalThis !== "undefined" && globalThis.localStorage
        ? globalThis.localStorage
        : null;
  const current = readStoredTheme(store);
  applyTheme(current, targetDoc);
  if (targetDoc && typeof targetDoc.querySelectorAll === "function") {
    const buttons = targetDoc.querySelectorAll("[data-theme-value]");
    for (const btn of buttons) {
      if (typeof btn.addEventListener === "function") {
        btn.addEventListener("click", () => {
          const next = btn.getAttribute("data-theme-value");
          applyTheme(next, targetDoc, store);
        });
      }
    }
  }
  return current;
}

const themeToggleApi = {
  STORAGE_KEY,
  VALID_THEMES,
  normalizeTheme,
  readStoredTheme,
  storeTheme,
  applyTheme,
  initThemeToggle,
};

if (typeof globalThis !== "undefined") {
  globalThis.AgySiteTheme = themeToggleApi;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = themeToggleApi;
}
