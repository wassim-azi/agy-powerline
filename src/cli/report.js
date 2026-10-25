// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  resolveInstallDir,
  GLOBAL_DIR,
  statuslineCommand,
  readInstallMeta,
  readAgySettings,
  isWsl,
} = require("../lib/paths");
const { setConfigDir, readConfigFile, detectStyle } = require("../lib/shared");
const { detectColorDepth } = require("../lib/colors");
const { readLog, getLogPath, clearLog, redact, isLogEnabled, LOG_NAME } = require("../lib/log");
const { version } = require("../../package.json");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const GB = 1024 ** 3;

function gb(bytes) {
  return `${(bytes / GB).toFixed(1)} GB`;
}

function linuxDistro() {
  try {
    const text = fs.readFileSync("/etc/os-release", "utf8");
    const match = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(text);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

function diskSpace(dir) {
  try {
    // statfs needs an existing path; fall back to the home drive.
    const target = fs.existsSync(dir) ? dir : os.homedir();
    const stats = fs.statfsSync(target);
    const free = stats.bavail * stats.bsize;
    const total = stats.blocks * stats.bsize;
    return `${gb(free)} free of ${gb(total)} (${Math.round((free / total) * 100)}% free)`;
  } catch {
    return "unknown";
  }
}

function fullIcu() {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(["de-DE", "ja-JP"]).length === 2;
  } catch {
    return false;
  }
}

function terminal(env) {
  const parts = [];
  for (const key of ["TERM", "TERM_PROGRAM", "TERM_PROGRAM_VERSION", "COLORTERM"]) {
    if (env[key] && /^[\w.+-]{1,40}$/.test(env[key])) {
      parts.push(`${key}=${env[key]}`);
    }
  }
  parts.push(`Windows Terminal: ${env.WT_SESSION ? "yes" : "no"}`);
  if (process.stdout.columns) {
    parts.push(`${process.stdout.columns} columns`);
  }
  parts.push(`colors: ${detectColorDepth(env)}`);
  return parts.join(", ");
}

// Intel model names already carry the clock speed; others get it appended.
function cpuSummary(cpus) {
  const model = cpus[0].model.trim().replace(/\s+/g, " ");
  const speed =
    /GHz/i.test(model) || !cpus[0].speed ? "" : ` @ ${(cpus[0].speed / 1000).toFixed(1)} GHz`;
  return `${model}${speed} × ${cpus.length} threads`;
}

// Only the program name: the full path would hold the user's folders.
function shellName(env) {
  const shell = env.SHELL || env.ComSpec || env.COMSPEC || "";
  const name = path.basename(shell.replace(/\\/g, "/"));
  return /^[\w.+-]{1,30}$/.test(name) ? name : "unknown";
}

// Machine facts that help reproduce a bug and identify nobody: no hostname,
// username, paths, network details, time zone or locale.
function systemInfo(installDir, env = process.env) {
  const cpus = os.cpus();
  const total = os.totalmem();
  const free = os.freemem();
  const distro = process.platform === "linux" ? linuxDistro() : "";
  const osVersion = os.version();

  const rows = [
    [
      "OS",
      redact(`${osVersion || os.type()} (${process.platform} ${os.release()} ${process.arch})`),
    ],
  ];
  if (distro) {
    rows.push(["Distribution", redact(distro)]);
  }
  rows.push(
    ["WSL", isWsl() ? "yes" : "no"],
    [
      "Node",
      `${process.version} (ICU ${process.versions.icu || "none"}, full locale data: ${fullIcu() ? "yes" : "no"})`,
    ],
    ["CPU", cpus.length ? redact(cpuSummary(cpus)) : "unknown"],
    [
      "Memory",
      `${gb(total - free)} used of ${gb(total)} (${Math.round(((total - free) / total) * 100)}%)`,
    ],
    [
      "Load average",
      process.platform === "win32"
        ? "n/a on Windows"
        : os
            .loadavg()
            .map((n) => n.toFixed(2))
            .join(" "),
    ],
    ["Disk (install drive)", diskSpace(installDir)],
    ["Terminal", terminal(env)],
    ["Shell", shellName(env)],
    ["CLI memory", `${Math.round(process.memoryUsage().rss / 1024 ** 2)} MB`]
  );
  return rows;
}

function installLocation(installDir, env) {
  if (env.AGY_POWERLINE_HOME) {
    return "AGY_POWERLINE_HOME";
  }
  return path.resolve(installDir) === path.resolve(GLOBAL_DIR)
    ? "default (~/.agy-powerline)"
    : "other";
}

// The config as settings and widget ids only: no commands, labels or text.
function configRows(installDir, env) {
  const rows = [];
  const meta = readInstallMeta(installDir);
  const hasScripts = fs.existsSync(path.join(installDir, "statusline.js"));

  rows.push(["Version", version]);
  rows.push([
    "Installed scripts",
    !hasScripts
      ? "not installed"
      : meta?.version
        ? `${meta.version}${meta.version === version ? " (matches)" : " (stale: run init --yes)"}`
        : "unknown",
  ]);
  rows.push(["Install location", installLocation(installDir, env)]);

  const settings = readAgySettings();
  const command = settings?.statusLine?.command || "";
  rows.push([
    "Antigravity statusLine",
    !command
      ? "not set"
      : hasScripts && command === statuslineCommand(installDir)
        ? "points at this install"
        : "a different command",
  ]);

  setConfigDir(installDir);
  const { exists, config, error } = readConfigFile();
  rows.push([
    "Config",
    error ? "invalid JSON (showing defaults)" : exists ? "valid" : "missing (defaults)",
  ]);
  rows.push(["Layout / theme", `${config.layout} / ${config.theme}`]);
  rows.push(["Powerline style", detectStyle(config.powerline) || "custom"]);
  rows.push([
    "Options",
    [
      `emojis ${config.emojis ? "on" : "off"}`,
      `ascii ${config.ascii ? "on" : "off"}`,
      `minimalist ${config.minimalist ? "on" : "off"}`,
      `row gaps ${config.rowGap ? "on" : "off"}`,
      `pacing ${config.pacing ? "on" : "off"}`,
      `color ${config.color}`,
      `clock ${config.clock.timeZone || config.clock.locale ? "custom" : "default"}`,
    ].join(", "),
  ]);
  rows.push(["Widgets", config.widgets.map((widget) => widget.id).join(", ") || "none"]);
  rows.push(["Problem log", isLogEnabled(error ? null : config, env) ? "on" : "off"]);
  return rows;
}

function table(rows) {
  return ["| | |", "| :--- | :--- |", ...rows.map(([key, value]) => `| ${key} | ${value} |`)].join(
    "\n"
  );
}

function buildReport(installDir, env = process.env) {
  const entries = readLog(getLogPath(installDir));
  const lines = [
    "## agy-powerline report",
    "",
    "Generated on this machine by `npx agy-powerline report`. It contains no names, paths, email",
    "addresses or session data; read it before sharing to see exactly what it says.",
    "",
    "### System",
    "",
    table(systemInfo(installDir, env)),
    "",
    "### agy-powerline",
    "",
    table(configRows(installDir, env)),
    "",
    `### Problem log (${entries.length} ${entries.length === 1 ? "entry" : "entries"})`,
    "",
  ];

  if (entries.length) {
    lines.push("```jsonl", ...entries.map((entry) => JSON.stringify(entry)), "```");
  } else {
    lines.push("No problems recorded.");
  }

  return lines.join("\n") + "\n";
}

function reportCommand(options = {}) {
  const installDir = resolveInstallDir();

  if (options.clear) {
    clearLog(installDir);
    console.log(`${GREEN}✔${RESET} Cleared ${LOG_NAME}.`);
    return;
  }

  const report = buildReport(installDir);

  if (options.output) {
    const target = path.resolve(String(options.output));
    fs.writeFileSync(target, report, "utf8");
    console.error(`${GREEN}✔${RESET} Report written to ${target}`);
    console.error(`  ${DIM}Attach it to your GitHub issue after reading it.${RESET}`);
  } else {
    process.stdout.write(report);
  }

  // A debug dump helps with rendering bugs and holds no personal data.
  if (fs.existsSync(path.join(installDir, "last-payload.json"))) {
    console.error(
      `${YELLOW}tip${RESET} for a rendering bug, also attach last-payload.json from the install folder (no personal data).`
    );
  }
}

module.exports = {
  reportCommand,
  buildReport,
  systemInfo,
};
