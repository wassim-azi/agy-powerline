// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Single source of truth for built-in widgets: catalog metadata, icons/labels,
// terminal-fitting drop priority, capability flags, option descriptors, and
// layout-agnostic rendering across Pills, Lines and Classic.
//
// Runtime note: this module is explicitly listed in RUNTIME_FILES
// (src/lib/paths.js) and bundled into the single installed statusline.js.

const {
  formatClockTime,
  formatTokens,
  shortModelName,
  formatTokenSplit,
  formatUsage,
  formatSessionTime,
  formatGitSync,
  formatGitOperation,
  gitChangeParts,
  gitFileParts,
  formatTasks,
  formatMode,
  formatCost,
  limitWidth,
  shortenPath,
  fishPath,
  fishBranch,
  homePath,
  linkPath,
  linkGitBranch,
  linkGitSha,
  basenameOf,
} = require("./formatters");
const { t } = require("./i18n");

function renderQuotaMeter(sessionKey, colorSlot, { hideWhenDisabled = false } = {}) {
  return (ctx) => {
    const quota = ctx.session[sessionKey];
    if (!quota || (hideWhenDisabled && quota.disabled && ctx.widget?.showDisabled !== true)) {
      return null;
    }
    return ctx.quotaMeter(quota, colorSlot);
  };
}

function renderQuotaPct(sessionKey, colorSlot) {
  return (ctx) => {
    const quota = ctx.session[sessionKey];
    return quota ? ctx.quotaPct(quota, colorSlot) : null;
  };
}

function renderQuotaReset(sessionKey, colorSlot, weekly = false) {
  return (ctx) => ctx.quotaReset(ctx.session[sessionKey], colorSlot, weekly);
}

function renderUsageTotal(period) {
  return (ctx) => {
    const usage = formatUsage(ctx.session.usage?.[period], ctx.widget, ctx.ascii, ctx.session.lang);
    return usage ? ctx.budgetText(usage.text, usage.pct) : null;
  };
}

// Catalog order matches the TUI widget picker and website widget directory.
// description: one sentence, shown in the configure details panel.
// summary: six words at most, shown next to the label in configure's lists.
// dropPriority: lower numbers drop first when fitting a row to terminal_width.
const WIDGET_DEFINITIONS = [
  {
    id: "model",
    label: "Model",
    unique: true,
    description: "the model in use",
    summary: "the model in use",
    tag: { icon: "🤖", name: "Model", key: "tag_model", iconOnly: true },
    dropPriority: 48,
    maxWidth: true,
    options: ["short"],
    render: (ctx) => {
      if (!ctx.session.model) {
        return null;
      }
      const value = limitWidth(
        ctx.widget?.short ? shortModelName(ctx.session.model, ctx.ascii) : ctx.session.model,
        ctx.widget,
        ctx.ascii
      );
      return ctx.text(value, { pillColor: "model", linesColor: "model" });
    },
  },
  {
    id: "quota",
    label: "Tightest Quota",
    unique: true,
    description: "the quota bucket closest to running out, with its reset",
    summary: "quota closest to running out",
    tag: { icon: "⏳", name: "Quota", key: "tag_quota" },
    dropPriority: 47,
    quota: true,
    quotaKey: "tightestQuota",
    paceDelta: true,
    render: (ctx) =>
      ctx.session.tightestQuota ? ctx.tightestQuota(ctx.session.tightestQuota) : null,
  },
  {
    id: "fiveHourBar",
    label: "5h Remaining Bar",
    unique: true,
    description: "5-hour quota left, as a meter",
    summary: "5-hour quota left, as a meter",
    tag: { icon: "⏳", name: "5h", key: "tag_5h", iconOnly: true },
    dropPriority: 46,
    quota: true,
    quotaKey: "fiveHour",
    meter: true,
    paced: true,
    render: renderQuotaMeter("fiveHour", "fiveHour"),
  },
  {
    id: "fiveHourPct",
    label: "5h Remaining %",
    unique: true,
    description: "5-hour quota left, as a percentage",
    summary: "5-hour quota left, in percent",
    tag: { icon: "⏳", name: "5h", key: "tag_5h" },
    dropPriority: 45,
    quota: true,
    quotaKey: "fiveHour",
    paceDelta: true,
    render: renderQuotaPct("fiveHour", "fiveHour"),
  },
  {
    id: "fiveHourReset",
    label: "5h Reset Timer",
    unique: true,
    description: "time until the 5-hour quota resets",
    summary: "when the 5-hour quota resets",
    tag: { icon: "🔄", name: "Reset", key: "tag_reset" },
    dropPriority: 34,
    reset: true,
    quotaKey: "fiveHour",
    render: renderQuotaReset("fiveHour", "fiveHour", false),
  },
  {
    id: "weeklyBar",
    label: "7d Remaining Bar",
    unique: true,
    description: "7-day quota left, as a meter",
    summary: "7-day quota left, as a meter",
    tag: { icon: "📅", name: "7d", key: "tag_7d", iconOnly: true },
    dropPriority: 42,
    quota: true,
    quotaKey: "weekly",
    meter: true,
    paced: true,
    render: renderQuotaMeter("weekly", "weekly"),
  },
  {
    id: "weeklyPct",
    label: "7d Remaining %",
    unique: true,
    description: "7-day quota left, as a percentage",
    summary: "7-day quota left, in percent",
    tag: { icon: "📅", name: "7d", key: "tag_7d" },
    dropPriority: 41,
    quota: true,
    quotaKey: "weekly",
    paceDelta: true,
    render: renderQuotaPct("weekly", "weekly"),
  },
  {
    id: "weeklyReset",
    label: "7d Reset Timer",
    unique: true,
    description: "time until the 7-day quota resets",
    summary: "when the 7-day quota resets",
    tag: { icon: "🔄", name: "Reset", key: "tag_reset" },
    dropPriority: 33,
    reset: true,
    quotaKey: "weekly",
    render: renderQuotaReset("weekly", "weekly", true),
  },
  {
    id: "thirdPartyFiveHour",
    label: "3P 5h Remaining",
    unique: true,
    description: "third-party 5-hour quota left, hidden when off",
    summary: "third-party 5-hour quota left",
    tag: { icon: "🧪", name: "3P 5h", key: "tag_3p_5h" },
    dropPriority: 31,
    quota: true,
    quotaKey: "thirdPartyFiveHour",
    meter: true,
    paced: true,
    options: ["showDisabled"],
    render: renderQuotaMeter("thirdPartyFiveHour", "thirdParty", { hideWhenDisabled: true }),
  },
  {
    id: "thirdPartyWeekly",
    label: "3P 7d Remaining",
    unique: true,
    description: "third-party 7-day quota left",
    summary: "third-party 7-day quota left",
    tag: { icon: "🧪", name: "3P 7d", key: "tag_3p_7d" },
    dropPriority: 30,
    quota: true,
    quotaKey: "thirdPartyWeekly",
    meter: true,
    paced: true,
    render: renderQuotaMeter("thirdPartyWeekly", "thirdParty"),
  },
  {
    id: "argonWeekly",
    label: "Argon 7d Remaining",
    unique: true,
    description: "Gemini 4 Argon's own 7-day quota left (Google AI Pro), hidden when not sent",
    summary: "Argon 7-day quota left",
    tag: { icon: "🔮", name: "Argon 7d", key: "tag_argon_7d" },
    dropPriority: 32,
    quota: true,
    quotaKey: "argonWeekly",
    meter: true,
    paced: true,
    // Argon is a Gemini model, so its quota takes the Gemini 7d color; the
    // 🔮 tag tells the two apart.
    render: renderQuotaMeter("argonWeekly", "weekly"),
  },
  {
    id: "argonReset",
    label: "Argon Reset Timer",
    unique: true,
    description: "time until Gemini 4 Argon's 7-day quota resets, hidden when not sent",
    summary: "when the Argon quota resets",
    tag: { icon: "🔄", name: "Argon reset", key: "tag_argon_reset" },
    dropPriority: 29,
    reset: true,
    quotaKey: "argonWeekly",
    render: renderQuotaReset("argonWeekly", "weekly", true),
  },
  {
    id: "context",
    label: "Context Bar",
    unique: true,
    description: "context window used, as a meter with tokens and %",
    summary: "context window used, as a meter",
    tag: { icon: "💾", name: "Context", key: "tag_context", iconOnly: true },
    dropPriority: 44,
    context: true,
    meter: true,
    render: (ctx) => ctx.contextBar(),
  },
  {
    id: "contextPct",
    label: "Context %",
    unique: true,
    description: "context window used, as a percentage",
    summary: "context window used, in percent",
    tag: { icon: "💾", name: "Context", key: "tag_context" },
    dropPriority: 43,
    context: true,
    render: (ctx) => ctx.contextPct(),
  },
  {
    id: "contextTokens",
    label: "Context Tokens",
    unique: true,
    description: "context tokens used out of the window size",
    summary: "context tokens out of window size",
    tag: { icon: "💾", name: "Context", key: "tag_context" },
    dropPriority: 35,
    context: true,
    render: (ctx) => ctx.contextTokens(),
  },
  {
    id: "cwd",
    label: "Working Directory",
    unique: true,
    description: "current folder, with ~ for home",
    summary: "current working folder",
    tag: { icon: "📂", name: "Dir", key: "tag_dir" },
    dropPriority: 24,
    maxWidth: true,
    options: ["depth", "fish", "pathLink"],
    render: (ctx) => {
      const home = homePath(ctx.session.cwd);
      const pathText =
        ctx.widget?.fish === true
          ? fishPath(home, ctx.widget?.depth)
          : shortenPath(home, ctx.widget?.depth, ctx.ascii);
      const name = limitWidth(pathText, ctx.widget, ctx.ascii, ctx.session.lang);
      if (!name) {
        return null;
      }
      return ctx.text(linkPath(name, ctx.session.cwd, ctx.widget, ctx.ascii), {
        pillColor: "meta",
        linesColor: "location",
      });
    },
  },
  {
    id: "project",
    label: "Project Directory",
    unique: true,
    description: "name of the project folder",
    summary: "project folder name",
    tag: { icon: "📦", name: "Project", key: "tag_project" },
    dropPriority: 23,
    maxWidth: true,
    options: ["pathLink"],
    render: (ctx) => {
      const name = limitWidth(basenameOf(ctx.session.project), ctx.widget, ctx.ascii);
      if (!name) {
        return null;
      }
      return ctx.text(linkPath(name, ctx.session.project, ctx.widget, ctx.ascii), {
        pillColor: "meta",
        linesColor: "location",
      });
    },
  },
  {
    id: "os",
    label: "Operating System",
    unique: true,
    description: "system agy runs on, including WSL",
    summary: "system running agy",
    tag: { icon: "💻", name: "" },
    dropPriority: 2,
    render: (ctx) => {
      if (!ctx.session.os) {
        return null;
      }
      return ctx.text(ctx.session.os, {
        pillColor: "meta",
        linesColor: "location",
        icon: ctx.osIcons[ctx.session.os],
      });
    },
  },
  {
    id: "host",
    label: "Host",
    unique: true,
    description: "current user and short host name",
    summary: "current user and host",
    tag: { icon: "👤", name: "Host", key: "tag_host", iconOnly: true },
    dropPriority: 3,
    render: (ctx) => {
      if (!ctx.session.hostname) {
        return null;
      }
      const name = ctx.session.username
        ? `${ctx.session.username}@${ctx.session.hostname}`
        : ctx.session.hostname;
      return ctx.text(name, { pillColor: "meta", linesColor: "location" });
    },
  },
  {
    id: "git",
    label: "VCS Branch",
    unique: true,
    description:
      "current branch, marked when there are uncommitted changes, with how many commits it is ahead of or behind its upstream",
    summary: "branch, changes and ahead/behind",
    tag: { icon: "🌿", name: "" },
    dropPriority: 39,
    maxWidth: true,
    options: ["fish", "gitLink"],
    render: (ctx) => {
      // Antigravity can send vcs.type without a branch; an empty pill says nothing.
      if (!ctx.session.git?.branch) {
        return null;
      }
      const opStr =
        ctx.widget.operation === false ? "" : formatGitOperation(ctx.session.git.operation);
      const syncStr = formatGitSync(ctx.session.git.ahead, ctx.session.git.behind, ctx.ascii);
      const syncPart = syncStr ? ` ${syncStr}` : "";
      const rawBranch =
        ctx.widget?.fish === true ? fishBranch(ctx.session.git.branch) : ctx.session.git.branch;
      const branch = linkGitBranch(
        limitWidth(rawBranch, ctx.widget, ctx.ascii),
        ctx.session.git.branch,
        ctx.session,
        ctx.widget,
        ctx.ascii
      );
      return ctx.gitBranch({ branch, dirty: ctx.session.git.dirty, opStr, syncPart });
    },
  },
  {
    id: "gitChanges",
    label: "Git Line Changes",
    unique: true,
    description:
      "lines added and removed since the last commit, staged or not (new files that aren't staged don't count)",
    summary: "lines added and removed",
    tag: { icon: "📝", name: "Lines", key: "tag_lines" },
    dropPriority: 38,
    render: (ctx) => {
      const parts = gitChangeParts(ctx.session.gitDetails?.changes, ctx.ascii);
      return parts.length ? ctx.gitChanges(parts) : null;
    },
  },
  {
    id: "gitFiles",
    label: "Git File Counts",
    unique: true,
    description: "how many files are staged, modified, untracked and in conflict",
    summary: "staged, modified, untracked file counts",
    tag: { icon: "📄", name: "Files", key: "tag_files" },
    dropPriority: 37,
    render: (ctx) => {
      const files = ctx.session.gitDetails?.files;
      const parts = gitFileParts(files, ctx.ascii);
      return parts.length ? ctx.gitFiles(parts, files.conflicts > 0) : null;
    },
  },
  {
    id: "gitSha",
    label: "Git Commit",
    unique: true,
    description: "short ID of the commit checked out",
    summary: "short commit ID",
    tag: { icon: "📌", name: "Commit", key: "tag_commit" },
    dropPriority: 36,
    options: ["gitLink"],
    render: (ctx) => {
      if (!ctx.session.gitDetails?.sha) {
        return null;
      }
      return ctx.text(linkGitSha(ctx.session.gitDetails.sha, ctx.session, ctx.widget, ctx.ascii), {
        pillColor: "git",
        linesColor: "git",
      });
    },
  },
  {
    id: "gitStash",
    label: "Git Stash Count",
    unique: true,
    description: "how many stashes the repository holds; hidden when there are none",
    summary: "number of stashes",
    tag: { icon: "💼", name: "Stash", key: "tag_stash" },
    dropPriority: 4,
    render: (ctx) => {
      if (!(ctx.session.gitDetails?.stash > 0)) {
        return null;
      }
      return ctx.text(String(ctx.session.gitDetails.stash), {
        pillColor: "git",
        linesColor: "git",
      });
    },
  },
  {
    id: "gitWorktree",
    label: "Git Worktree",
    unique: true,
    description: "name of the linked worktree you're in; hidden in the main one",
    summary: "linked worktree name",
    tag: { icon: "🌳", name: "Worktree", key: "tag_worktree" },
    dropPriority: 5,
    maxWidth: true,
    render: (ctx) => {
      if (!ctx.session.gitDetails?.worktree) {
        return null;
      }
      return ctx.text(limitWidth(ctx.session.gitDetails.worktree, ctx.widget, ctx.ascii), {
        pillColor: "git",
        linesColor: "git",
      });
    },
  },
  {
    id: "plan",
    label: "Plan Tier",
    unique: true,
    description: "your Antigravity plan",
    summary: "your Antigravity plan",
    tag: { icon: "⭐", name: "Plan", key: "tag_plan" },
    dropPriority: 21,
    render: (ctx) => (ctx.session.plan ? ctx.text(ctx.session.plan) : null),
  },
  {
    id: "agent",
    label: "Active Agent",
    unique: true,
    description: "name of the active non-default agent, hidden for the default agent",
    summary: "active non-default agent name",
    tag: { icon: "🧩", name: "Agent", key: "tag_agent", iconOnly: true },
    dropPriority: 26,
    maxWidth: true,
    render: (ctx) =>
      ctx.session.agentName
        ? ctx.text(limitWidth(ctx.session.agentName, ctx.widget, ctx.ascii))
        : null,
  },
  {
    id: "agentState",
    label: "Agent State",
    unique: true,
    description: "what the agent is doing, such as idle or thinking, plus tool confirmation",
    summary: "what the agent is doing",
    tag: { icon: "🟣", name: "Agent", key: "tag_agent" },
    dropPriority: 27,
    render: (ctx) => {
      if (!ctx.session.agentState && !ctx.session.toolConfirmation) {
        return null;
      }
      const state = ctx.session.agentState ? ctx.session.agentState.replace(/_/g, " ") : "";
      const text = ctx.session.toolConfirmation
        ? state
          ? `${state} (${t("confirm", ctx.session.lang)})`
          : t("confirm", ctx.session.lang)
        : state;
      const idle = ctx.session.agentState === "idle" && !ctx.session.toolConfirmation;
      const critical = ctx.session.toolConfirmation || ctx.session.agentState === "error";
      return ctx.agentState({ text, idle, critical });
    },
  },
  {
    id: "artifacts",
    label: "Artifacts",
    unique: true,
    description: "number of artifacts",
    summary: "number of artifacts",
    tag: { icon: "📎", name: "Artifacts", key: "tag_artifacts" },
    dropPriority: 18,
    render: (ctx) => (ctx.session.artifacts ? ctx.text(String(ctx.session.artifacts)) : null),
  },
  {
    id: "tasks",
    label: "Subagents & Tasks",
    unique: true,
    description: "running subagents and background tasks, shown only when there are some",
    summary: "running subagents and background tasks",
    tag: { icon: "👥", name: "" },
    dropPriority: 20,
    render: (ctx) => {
      const text = formatTasks(
        ctx.session.subagents,
        ctx.session.tasks,
        ctx.session.lang,
        ctx.subagentDetail(ctx.session, ctx.widget, ctx.ascii)
      );
      return text ? ctx.text(text) : null;
    },
  },
  {
    id: "queue",
    label: "Queued Messages",
    unique: true,
    description: "queued user messages waiting to run, hidden when 0",
    summary: "queued user message count",
    tag: { icon: "📨", name: "Queue", key: "tag_queue" },
    dropPriority: 19,
    render: (ctx) =>
      ctx.session.pendingInputs ? ctx.text(String(ctx.session.pendingInputs)) : null,
  },
  {
    id: "mode",
    label: "Mode",
    unique: true,
    description: "approval mode (e.g. accept-edits) and Vim mode, shown only when one is on",
    summary: "approval mode and Vim mode",
    tag: { icon: "🧭", name: "" },
    dropPriority: 28,
    render: (ctx) => {
      const text = formatMode(ctx.session.approvalMode, ctx.session.vimMode);
      if (!text) {
        return null;
      }
      // An approval mode like accept-edits changes what the agent may do alone.
      const approval = ctx.session.approvalMode && ctx.session.approvalMode !== "default";
      return ctx.text(text, {
        pillColor: approval ? "caution" : "meta",
        linesColor: approval ? "caution" : "text",
      });
    },
  },
  {
    id: "title",
    label: "Conversation Title",
    unique: true,
    description: "name of the current conversation, shown once it has one",
    summary: "current conversation title",
    tag: { icon: "💬", name: "" },
    dropPriority: 6,
    maxWidth: true,
    render: (ctx) =>
      ctx.session.title
        ? ctx.text(limitWidth(ctx.session.title, ctx.widget, ctx.ascii, ctx.titleMax))
        : null,
  },
  {
    id: "sessionTime",
    label: "Session Time",
    unique: true,
    description: "how long the current conversation has run",
    summary: "how long this session has run",
    tag: { icon: "⏱️", name: "Session", key: "tag_session" },
    dropPriority: 7,
    render: (ctx) => {
      const text = formatSessionTime(ctx.session.sessionStartMs, Date.now(), ctx.session.lang);
      return text ? ctx.text(text) : null;
    },
  },
  {
    id: "ram",
    label: "RAM Usage",
    unique: true,
    description: "memory used on this machine",
    summary: "memory used on this machine",
    tag: { icon: "💻", name: "RAM", key: "tag_ram" },
    dropPriority: 22,
    render: (ctx) => {
      if (ctx.isLines && ctx.session.ramPct == null) {
        return null;
      }
      const pct = ctx.session.ramPct ?? 0;
      const level = pct >= ctx.ramDanger ? "danger" : pct >= ctx.ramCaution ? "caution" : "normal";
      return ctx.valueWithLevel(`${pct}%`, level);
    },
  },
  {
    id: "version",
    label: "CLI Version",
    unique: true,
    description: "Antigravity CLI version",
    summary: "Antigravity CLI version",
    tag: { icon: "🔖", name: "" },
    dropPriority: 9,
    render: (ctx) => (ctx.session.version ? ctx.text(`v${ctx.session.version}`) : null),
  },
  {
    id: "sandbox",
    label: "Sandbox",
    unique: true,
    description: "sandbox and network access, shown only when on",
    summary: "sandbox and network access",
    tag: { icon: "🔒", name: "" },
    dropPriority: 40,
    render: (ctx) => {
      if (!ctx.session.sandbox) {
        return null;
      }
      const net = ctx.session.sandboxNet;
      const text = t(net ? "sandbox_net" : "sandbox_isolated", ctx.session.lang);
      return ctx.sandbox({ text, net });
    },
  },
  {
    id: "cacheRead",
    label: "Cache Read",
    unique: true,
    description: "input tokens read from the cache",
    summary: "input tokens read from cache",
    tag: { icon: "📥", name: "Cache read", key: "tag_cache_read" },
    dropPriority: 11,
    usage: true,
    render: (ctx) => {
      if (ctx.isLines && ctx.session.cacheRead == null) {
        return null;
      }
      return ctx.text(formatTokens(ctx.session.cacheRead));
    },
  },
  {
    id: "cacheCreate",
    label: "Cache Create",
    unique: true,
    description: "input tokens written to the cache",
    summary: "input tokens written to cache",
    tag: { icon: "📤", name: "Cache create", key: "tag_cache_create" },
    dropPriority: 10,
    usage: true,
    render: (ctx) => {
      if (ctx.isLines && ctx.session.cacheCreate == null) {
        return null;
      }
      return ctx.text(formatTokens(ctx.session.cacheCreate));
    },
  },
  {
    id: "cacheHit",
    label: "Cache Hit %",
    unique: true,
    description: "share of input tokens served from the cache",
    summary: "share of input from cache",
    tag: { icon: "⚡", name: "Cache hit", key: "tag_cache_hit" },
    dropPriority: 14,
    usage: true,
    render: (ctx) => ctx.cacheHit(ctx.session.cacheHitPct ?? 0),
  },
  {
    id: "totalTokens",
    label: "Total Tokens",
    unique: true,
    description: "session tokens, as a total or split into input and output",
    summary: "session tokens, total or split",
    tag: { icon: "🪙", name: "Tokens", key: "tag_tokens" },
    dropPriority: 13,
    options: ["splitTokens"],
    render: (ctx) => {
      if (!ctx.session.totalTokens) {
        return null;
      }
      const value = ctx.widget?.split
        ? formatTokenSplit(
            ctx.session.inputTokens,
            ctx.session.outputTokens,
            ctx.ascii,
            ctx.session.lang
          )
        : formatTokens(ctx.session.totalTokens);
      return ctx.text(value);
    },
  },
  {
    id: "cost",
    label: "Session Cost",
    unique: true,
    description: "estimated session spend in US dollars, hidden until reported",
    summary: "estimated session spend",
    tag: { icon: "💵", name: "Cost", key: "tag_cost" },
    dropPriority: 12,
    options: ["splitCost", "budgetCost"],
    render: (ctx) => {
      const text = formatCost(ctx.session.cost, ctx.widget, ctx.ascii, ctx.session.lang);
      if (!text) {
        return null;
      }
      const budget = ctx.widget?.budget;
      const pct =
        typeof budget === "number" && Number.isFinite(budget) && budget > 0
          ? (ctx.session.cost.totalUsd * 100) / budget
          : null;
      return ctx.budgetText(text, pct);
    },
  },
  {
    id: "clock",
    label: "Clock",
    unique: true,
    description: "current local time, in the format set under clock",
    summary: "current local time",
    tag: { icon: "🕒", name: "Clock", key: "tag_clock", iconOnly: true },
    dropPriority: 8,
    render: (ctx) => ctx.text(formatClockTime(new Date(), ctx.config.clock)),
  },
  {
    id: "tokensToday",
    label: "Tokens Today",
    unique: true,
    description: "tokens used today in all agy conversations, from agy's local data (Node 22.13+)",
    summary: "tokens used today, all conversations",
    tag: { icon: "📈", name: "Today", key: "tag_today" },
    dropPriority: 17,
    usageTotal: true,
    options: ["splitUsage", "budgetTokens"],
    render: renderUsageTotal("today"),
  },
  {
    id: "tokensWeek",
    label: "Tokens 7 Days",
    unique: true,
    description:
      "tokens used in the last 7 days in all agy conversations, from agy's local data (Node 22.13+)",
    summary: "tokens used over 7 days",
    tag: { icon: "📊", name: "7d", key: "tag_7d" },
    dropPriority: 16,
    usageTotal: true,
    options: ["splitUsage", "budgetTokens"],
    render: renderUsageTotal("week"),
  },
  {
    id: "tokensMonth",
    label: "Tokens 30 Days",
    unique: true,
    description:
      "tokens used in the last 30 days in all agy conversations, from agy's local data (Node 22.13+)",
    summary: "tokens used over 30 days",
    tag: { icon: "🗓️", name: "30d", key: "tag_30d" },
    dropPriority: 15,
    usageTotal: true,
    options: ["splitUsage", "budgetTokens"],
    render: renderUsageTotal("month"),
  },
  {
    id: "exec",
    label: "Shell Command",
    unique: false,
    description: "runs a shell command on every refresh (global config only)",
    summary: "output of a shell command",
    dropPriority: 25,
    maxWidth: true,
    options: ["exec"],
    render: (ctx) => {
      // Only real output is cut: the [cmd] preview and blocked markers stay whole.
      const output =
        ctx.session.execMode === "run"
          ? limitWidth(ctx.execWidgetOutput(ctx.widget, ctx.session), ctx.widget, ctx.ascii)
          : ctx.execWidgetOutput(ctx.widget, ctx.session);
      return output ? ctx.execSegment(output) : null;
    },
  },
  {
    id: "env",
    label: "Environment Variable",
    unique: false,
    description: "value of an environment variable, hidden when unset",
    summary: "value of an environment variable",
    tag: { icon: "🔧", name: "" },
    dropPriority: 1,
    maxWidth: true,
    options: ["envVar"],
    render: (ctx) => {
      const entry = ctx.readEnvValue(ctx.widget, ctx.session, ctx.ascii);
      if (!entry) {
        return null;
      }
      const envWidget =
        ctx.widget?.label === undefined ? { ...ctx.widget, label: entry.name } : ctx.widget;
      const envTag = ctx.widgetTag("env", {
        emojis: ctx.emojis,
        raw: ctx.raw,
        widget: envWidget,
        ascii: ctx.ascii,
        lang: ctx.session.lang,
      });
      return ctx.taggedText(envTag, entry.value);
    },
  },
  {
    id: "customText",
    label: "Custom Badge",
    unique: false,
    description: "a fixed text of your choice",
    summary: "a fixed text of your choice",
    tag: { icon: "🏷️", name: "" },
    dropPriority: 0,
    maxWidth: true,
    options: ["text"],
    render: (ctx) =>
      ctx.widget?.text ? ctx.text(limitWidth(ctx.widget.text, ctx.widget, ctx.ascii)) : null,
  },
  {
    id: "separator",
    label: "Flex Separator",
    unique: false,
    description: "expands to fill available terminal width",
    summary: "pushes later widgets to the right",
    layoutHelper: true,
  },
  {
    id: "lineBreak",
    label: "New Line",
    unique: false,
    description: "starts the next widgets on a new row",
    summary: "starts a new row",
    layoutHelper: true,
  },
];

const WIDGET_DEF_BY_ID = Object.fromEntries(WIDGET_DEFINITIONS.map((def) => [def.id, def]));

const VALID_WIDGET_IDS = new Set(WIDGET_DEFINITIONS.map((def) => def.id));

const WIDGET_CATALOG = WIDGET_DEFINITIONS.map(({ id, label, unique, description, summary }) => ({
  id,
  label,
  unique,
  description,
  summary,
}));

const WIDGET_TAGS = Object.fromEntries(
  WIDGET_DEFINITIONS.filter((def) => def.tag).map((def) => [def.id, def.tag])
);

const DROP_ORDER = WIDGET_DEFINITIONS.filter((def) => typeof def.dropPriority === "number")
  .sort((a, b) => a.dropPriority - b.dropPriority)
  .map((def) => def.id);

const idsWhere = (pred) => new Set(WIDGET_DEFINITIONS.filter(pred).map((def) => def.id));

const QUOTA_WIDGETS = idsWhere((def) => def.quota);
const PACE_DELTA_WIDGETS = idsWhere((def) => def.paceDelta);
const CONTEXT_WIDGETS = idsWhere((def) => def.context);
const RESET_WIDGETS = idsWhere((def) => def.reset);
const USAGE_WIDGETS = idsWhere((def) => def.usage);
const USAGE_TOTAL_WIDGETS = idsWhere((def) => def.usageTotal);
const PACED_WIDGETS = idsWhere((def) => def.paced);
const METER_WIDGETS = idsWhere((def) => def.meter);
const MAX_WIDTH_WIDGETS = idsWhere((def) => def.maxWidth);

const SHOW_BELOW_SESSION_KEYS = Object.fromEntries(
  WIDGET_DEFINITIONS.filter((def) => def.quotaKey).map((def) => [def.id, def.quotaKey])
);

function renderWidget(id, ctx) {
  const def = WIDGET_DEF_BY_ID[id];
  return def?.render ? def.render(ctx) : null;
}

module.exports = {
  WIDGET_DEFINITIONS,
  WIDGET_DEF_BY_ID,
  VALID_WIDGET_IDS,
  WIDGET_CATALOG,
  WIDGET_TAGS,
  DROP_ORDER,
  QUOTA_WIDGETS,
  PACE_DELTA_WIDGETS,
  CONTEXT_WIDGETS,
  RESET_WIDGETS,
  USAGE_WIDGETS,
  USAGE_TOTAL_WIDGETS,
  PACED_WIDGETS,
  METER_WIDGETS,
  MAX_WIDTH_WIDGETS,
  SHOW_BELOW_SESSION_KEYS,
  renderWidget,
};
