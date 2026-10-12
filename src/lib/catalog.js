"use strict";

const WIDGET_CATALOG = [
  { id: "model", label: "Model", unique: true, description: "the model in use" },
  {
    id: "quota",
    label: "Tightest Quota",
    unique: true,
    description: "the quota bucket closest to running out, with its reset",
  },
  {
    id: "fiveHourBar",
    label: "5h Remaining Bar",
    unique: true,
    description: "5-hour quota left, as a meter",
  },
  {
    id: "fiveHourPct",
    label: "5h Remaining %",
    unique: true,
    description: "5-hour quota left, as a percentage",
  },
  {
    id: "fiveHourReset",
    label: "5h Reset Timer",
    unique: true,
    description: "time until the 5-hour quota resets",
  },
  {
    id: "weeklyBar",
    label: "7d Remaining Bar",
    unique: true,
    description: "7-day quota left, as a meter",
  },
  {
    id: "weeklyPct",
    label: "7d Remaining %",
    unique: true,
    description: "7-day quota left, as a percentage",
  },
  {
    id: "weeklyReset",
    label: "7d Reset Timer",
    unique: true,
    description: "time until the 7-day quota resets",
  },
  {
    id: "thirdPartyFiveHour",
    label: "3P 5h Remaining",
    unique: true,
    description: "third-party 5-hour quota left, hidden when off",
  },
  {
    id: "thirdPartyWeekly",
    label: "3P 7d Remaining",
    unique: true,
    description: "third-party 7-day quota left",
  },
  {
    id: "context",
    label: "Context Bar",
    unique: true,
    description: "context window used, as a meter with tokens and %",
  },
  {
    id: "contextPct",
    label: "Context %",
    unique: true,
    description: "context window used, as a percentage",
  },
  {
    id: "contextTokens",
    label: "Context Tokens",
    unique: true,
    description: "context tokens used out of the window size",
  },
  {
    id: "cwd",
    label: "Working Directory",
    unique: true,
    description: "current folder, with ~ for home",
  },
  {
    id: "project",
    label: "Project Directory",
    unique: true,
    description: "name of the project folder",
  },
  {
    id: "git",
    label: "VCS Branch",
    unique: true,
    description: "current branch, marked when there are uncommitted changes",
  },
  { id: "plan", label: "Plan Tier", unique: true, description: "your Antigravity plan" },
  {
    id: "agentState",
    label: "Agent State",
    unique: true,
    description: "what the agent is doing, such as idle or thinking",
  },
  {
    id: "artifacts",
    label: "Artifacts",
    unique: true,
    description: "number of artifacts",
  },
  {
    id: "tasks",
    label: "Subagents & Tasks",
    unique: true,
    description: "running subagents and background tasks, shown only when there are some",
  },
  {
    id: "mode",
    label: "Mode",
    unique: true,
    description: "approval mode (e.g. accept-edits) and Vim mode, shown only when one is on",
  },
  { id: "ram", label: "RAM Usage", unique: true, description: "memory used on this machine" },
  { id: "version", label: "CLI Version", unique: true, description: "Antigravity CLI version" },
  {
    id: "sandbox",
    label: "Sandbox",
    unique: true,
    description: "sandbox and network access, shown only when on",
  },
  {
    id: "cacheRead",
    label: "Cache Read",
    unique: true,
    description: "input tokens read from the cache",
  },
  {
    id: "cacheCreate",
    label: "Cache Create",
    unique: true,
    description: "input tokens written to the cache",
  },
  {
    id: "cacheHit",
    label: "Cache Hit %",
    unique: true,
    description: "share of input tokens served from the cache",
  },
  {
    id: "totalTokens",
    label: "Total Tokens",
    unique: true,
    description: "session tokens, as a total or split into input and output",
  },
  {
    id: "exec",
    label: "Shell Command",
    unique: false,
    description: "runs a shell command on every refresh (global config only)",
  },
  {
    id: "customText",
    label: "Custom Badge",
    unique: false,
    description: "a fixed text of your choice",
  },
  {
    id: "separator",
    label: "Flex Separator",
    unique: false,
    description: "expands to fill available terminal width",
  },
  {
    id: "lineBreak",
    label: "New Line",
    unique: false,
    description: "starts the next widgets on a new row",
  },
];

const WIDGET_BY_ID = Object.fromEntries(WIDGET_CATALOG.map((widget) => [widget.id, widget]));

function widgetLabel(id) {
  return WIDGET_BY_ID[id]?.label ?? id;
}

module.exports = {
  WIDGET_CATALOG,
  WIDGET_BY_ID,
  widgetLabel,
};
