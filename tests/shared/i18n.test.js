"use strict";

const { record, stripAnsi } = require("../helpers");
const {
  defaultConfig,
  applyPreset,
  renderStatusline,
  sampleData,
  mergeConfig,
  LAYOUT_ORDER,
} = require("../../src/lib/shared");
const {
  MESSAGES,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  matchLanguage,
  resolveLanguage,
  t,
} = require("../../src/lib/i18n");
const { VALID_WIDGET_IDS } = require("../../src/lib/config");

const STUB = "zz";

// A made-up language whose every message is «key», so any English the bar
// still prints, or payload text it changes, shows up.
function withStubLanguage(fn) {
  MESSAGES[STUB] = Object.fromEntries(Object.keys(MESSAGES.en).map((key) => [key, `«${key}»`]));
  SUPPORTED_LANGUAGES.push(STUB);
  try {
    return fn();
  } finally {
    delete MESSAGES[STUB];
    SUPPORTED_LANGUAGES.splice(SUPPORTED_LANGUAGES.indexOf(STUB), 1);
  }
}

// Every widget, no width limit, emojis off so iconOnly widgets print their names.
function renderAll(language, extra = {}) {
  const data = {
    ...sampleData(),
    terminal_width: 0,
    exceeds_200k_tokens: true,
    sandbox: { enabled: true, allow_network: false },
  };
  const widgets = [...VALID_WIDGET_IDS]
    .filter((id) => !["separator", "lineBreak", "flex"].includes(id))
    .map((id) => (id === "exec" ? { id, cmd: "echo hi" } : { id }));
  return LAYOUT_ORDER.map((layout) =>
    stripAnsi(
      renderStatusline(
        data,
        { ...defaultConfig(), layout, widgets, emojis: false, language, ...extra },
        { color: "none" }
      )
    )
  ).join("\n");
}

async function run() {
  record(
    "a language without messages, or anything that isn't a code, shows English",
    ["xx", "de-DE", "", 42, null, undefined, {}].every((code) => resolveLanguage(code) === "en") &&
      resolveLanguage("EN") === "en" &&
      resolveLanguage("en-US") === "en" &&
      matchLanguage("xx") === null &&
      mergeConfig({ language: "xx" }).language === "en" &&
      defaultConfig().language === DEFAULT_LANGUAGE
  );

  record(
    "a missing message falls back to English and an unknown key to the key",
    t("rem", "xx") === "rem" && t("no_such_key", "en") === "no_such_key" && t("rem") === "rem"
  );

  withStubLanguage(() => {
    const partial = MESSAGES[STUB];
    delete partial.tag_model;
    record(
      "a region code uses its base language, and a message it lacks comes in English",
      resolveLanguage("zz-ZZ") === STUB &&
        resolveLanguage("ZZ") === STUB &&
        t("tag_model", STUB) === "Model" &&
        t("rem", STUB) === "«rem»"
    );
  });

  const english = Object.keys(MESSAGES.en).sort();
  const incomplete = SUPPORTED_LANGUAGES.filter((lang) => {
    const keys = Object.keys(MESSAGES[lang]).sort();
    return (
      JSON.stringify(keys) !== JSON.stringify(english) ||
      Object.values(MESSAGES[lang]).some(
        (text) => typeof text !== "string" || !text.trim() || /[\x00-\x1f\x7f-\x9f]/.test(text)
      )
    );
  });
  record(
    "every language has exactly the English keys, each a non-empty string without control characters",
    incomplete.length === 0,
    incomplete.join(", ")
  );

  withStubLanguage(() => {
    const out = renderAll(STUB, { ascii: true });
    // What is left once the translated words are taken out.
    const bare = out.replace(/«[^»]*»/g, "");
    const english = [
      " rem",
      "Reset:",
      "Context:",
      "subagent",
      " task",
      "sandbox (",
      "[cmd]",
      ">200k",
      " in ",
      "Cache read",
    ].filter((text) => bare.includes(text));
    record(
      "every word of the bar's own goes through the language's messages",
      english.length === 0 && out.includes("«rem»") && out.includes("«tag_reset»: "),
      english.join(", ")
    );

    const payloadText = ["Gemini 3.8 Flash (High)", "main", "thinking", "agy-powerline"];
    const plain = renderAll(DEFAULT_LANGUAGE);
    record(
      "payload text (model, branch, agent state, folder) prints the same in every language",
      payloadText.every((text) => plain.includes(text) && out.includes(text)),
      payloadText.filter((text) => !out.includes(text)).join(", ")
    );

    const own = stripAnsi(
      renderStatusline(
        { ...sampleData(), terminal_width: 0 },
        {
          ...defaultConfig(),
          language: STUB,
          widgets: [{ id: "fiveHourReset", label: "Mine" }],
        },
        { color: "none" }
      )
    );
    record(
      "a widget's own label wins over the translated one",
      own.includes("Mine: ") && !own.includes("«tag_reset»"),
      JSON.stringify(own)
    );
  });

  record(
    "the English bar keeps its words",
    (() => {
      const out = stripAnsi(
        renderStatusline(
          { ...sampleData(), terminal_width: 0 },
          applyPreset(defaultConfig(), "full"),
          { color: "none" }
        )
      );
      return out.includes("% rem") && !out.includes("«");
    })()
  );
}

module.exports = { run };
