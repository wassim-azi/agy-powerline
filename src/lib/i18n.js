"use strict";

// The bar's own words: widget tags, captions and units. Payload text (model,
// branch, paths, agent state), git operation names, numbers and dates are
// never translated; dates follow clock.locale instead.
const MESSAGES = {
  en: {
    tag_model: "Model",
    tag_quota: "Quota",
    tag_5h: "5h",
    tag_7d: "7d",
    tag_reset: "Reset",
    tag_3p_5h: "3P 5h",
    tag_3p_7d: "3P 7d",
    tag_argon_7d: "Argon 7d",
    tag_argon_reset: "Argon reset",
    tag_context: "Context",
    tag_dir: "Dir",
    tag_project: "Project",
    tag_host: "Host",
    tag_lines: "Lines",
    tag_files: "Files",
    tag_commit: "Commit",
    tag_stash: "Stash",
    tag_worktree: "Worktree",
    tag_plan: "Plan",
    tag_agent: "Agent",
    tag_artifacts: "Artifacts",
    tag_session: "Session",
    tag_ram: "RAM",
    tag_cache_read: "Cache read",
    tag_cache_create: "Cache create",
    tag_cache_hit: "Cache hit",
    tag_tokens: "Tokens",
    tag_clock: "Clock",
    tag_today: "Today",

    rem: "rem",
    over_200k: ">200k",
    now: "now",
    unit_d: "d",
    unit_h: "h",
    unit_hr: "hr",
    unit_m: "m",
    subagent: "subagent",
    subagents: "subagents",
    task: "task",
    tasks: "tasks",
    tokens_in: "in",
    tokens_out: "out",
    sandbox_net: "sandbox (net)",
    sandbox_isolated: "sandbox (isolated)",
    cmd_preview: "[cmd]",
    cmd_blocked: "[blocked]",
  },
  fr: {
    tag_model: "Modèle",
    tag_quota: "Quota",
    tag_5h: "5h",
    tag_7d: "7j",
    tag_reset: "Réinit",
    tag_3p_5h: "Tiers 5h",
    tag_3p_7d: "Tiers 7j",
    tag_argon_7d: "Argon 7j",
    tag_argon_reset: "Réinit Argon",
    tag_context: "Contexte",
    tag_dir: "Dossier",
    tag_project: "Projet",
    tag_host: "Hôte",
    tag_lines: "Lignes",
    tag_files: "Fichiers",
    tag_commit: "Commit",
    tag_stash: "Stash",
    tag_worktree: "Worktree",
    tag_plan: "Offre",
    tag_agent: "Agent",
    tag_artifacts: "Artefacts",
    tag_session: "Session",
    tag_ram: "RAM",
    tag_cache_read: "Cache lu",
    tag_cache_create: "Cache écrit",
    tag_cache_hit: "Succès cache",
    tag_tokens: "Jetons",
    tag_clock: "Heure",
    tag_today: "Aujourd'hui",

    rem: "rest.",
    over_200k: ">200k",
    now: "maintenant",
    unit_d: "j",
    unit_h: "h",
    unit_hr: "h",
    unit_m: "m",
    subagent: "sous-agent",
    subagents: "sous-agents",
    task: "tâche",
    tasks: "tâches",
    tokens_in: "entrée",
    tokens_out: "sortie",
    sandbox_net: "sandbox (réseau)",
    sandbox_isolated: "sandbox (isolée)",
    cmd_preview: "[cmd]",
    cmd_blocked: "[bloqué]",
  },
};

const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = Object.keys(MESSAGES);

// The supported code a setting asks for: the code itself (any case), then its
// base language (fr-FR -> fr), or null.
function matchLanguage(code) {
  if (typeof code !== "string") {
    return null;
  }
  const wanted = code.trim().toLowerCase();
  const base = wanted.split("-")[0];
  return (
    SUPPORTED_LANGUAGES.find((id) => id.toLowerCase() === wanted) ??
    SUPPORTED_LANGUAGES.find((id) => id.toLowerCase() === base) ??
    null
  );
}

function resolveLanguage(code) {
  return matchLanguage(code) ?? DEFAULT_LANGUAGE;
}

function t(key, lang = DEFAULT_LANGUAGE) {
  return MESSAGES[lang]?.[key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key;
}

module.exports = {
  MESSAGES,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  matchLanguage,
  resolveLanguage,
  t,
};
