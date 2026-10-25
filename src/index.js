#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const fs = require("fs");
const path = require("path");
const { parseArgs } = require("util");
const { initCommand } = require("./cli/init");
const { configureCommand } = require("./cli/configure");
const { themeCommand } = require("./cli/theme");
const { layoutCommand } = require("./cli/layout");
const { presetCommand } = require("./cli/preset");
const { capsCommand } = require("./cli/caps");
const { gradientCommand } = require("./cli/gradient");
const { exportCommand } = require("./cli/export");
const { importCommand } = require("./cli/import");
const { doctorCommand } = require("./cli/doctor");
const { uninstallCommand } = require("./cli/uninstall");
const { reportCommand } = require("./cli/report");
const {
  setConfigDir,
  readConfigFile,
  renderStatusline,
  sampleData,
  applyRenderOverrides,
  THEME_ORDER,
  LAYOUT_ORDER,
  PRESET_ORDER,
} = require("./lib/shared");
const { STYLE_ORDER } = require("./lib/powerline");
const { GRADIENT_ORDER } = require("./lib/themes");
const { SUPPORTED_LANGUAGES } = require("./lib/i18n");
const { stripControl } = require("./lib/formatters");
const { resolveInstallDir, isTrustedInstallDir } = require("./lib/paths");
const { isLogEnabled, setLogDir, logError, jsonErrorMessage } = require("./lib/log");
const { dumpTarget, writePayloadDump } = require("./lib/payload-dump");
const { version: VERSION, homepage: SITE_URL } = require("../package.json");

const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const NAME = "agy-powerline";
const DESCRIPTION = "Interactive statusline for Google Antigravity";

// Each command lists its options in util.parseArgs format plus help text.
// `arg` names the optional positional argument passed before the options.
const COMMANDS = [
  {
    name: "init",
    description: "Install the statusline and wire it into Antigravity settings",
    options: {
      yes: {
        type: "boolean",
        short: "y",
        help: "overwrite scripts and replace statusLine without prompting",
      },
      stack: {
        type: "boolean",
        help: "stack statusline below Antigravity default bar (stack_with_default)",
      },
      "no-stack": {
        type: "boolean",
        help: "replace Antigravity default statusline (disable stacking)",
      },
      padding: {
        type: "string",
        value: "<lines>",
        help: "set padding blank lines above statusline",
      },
      preset: {
        type: "string",
        value: "<id>",
        help: "start from this widget preset (skips the question)",
      },
      layout: { type: "string", value: "<id>", help: "use this layout (skips the question)" },
      theme: {
        type: "string",
        value: "<id>",
        help: "use this theme, or dark, light, colorblind (skips the question)",
      },
      language: {
        type: "string",
        value: "<code>",
        help: `show the bar in this language (${SUPPORTED_LANGUAGES.join(", ")})`,
      },
    },
    run: (_arg, opts) =>
      initCommand({
        ...opts,
        stack: opts["no-stack"] ? false : opts.stack,
        padding: opts.padding === undefined ? undefined : parseInt(opts.padding, 10),
      }),
  },
  {
    name: "configure",
    aliases: ["config"],
    description: "Open the interactive widget, theme, and powerline TUI",
    options: {},
    run: () => configureCommand(),
  },
  {
    name: "theme",
    arg: "[name]",
    description: "View, preview, or switch the active theme (e.g. dark-aurora, light-paper)",
    options: {
      list: { type: "boolean", short: "l", help: "list all available themes and aliases" },
      gallery: {
        type: "boolean",
        short: "g",
        help: "display visual preview gallery of all themes",
      },
    },
    run: (arg, opts) => themeCommand(arg, opts),
  },
  {
    name: "layout",
    arg: "[name]",
    description: "View or switch the active layout (pills, lines)",
    options: {
      list: { type: "boolean", short: "l", help: "list all available layouts" },
    },
    run: (arg, opts) => layoutCommand(arg, opts),
  },
  {
    name: "preset",
    arg: "[name]",
    description:
      "View or apply a widget preset (default, compact, agent, git, tokens, quotas, full)",
    options: {
      list: { type: "boolean", short: "l", help: "list all available presets" },
    },
    run: (arg, opts) => presetCommand(arg, opts),
  },
  {
    name: "caps",
    arg: "[style]",
    description:
      "View or switch the powerline style: caps and joins (round, angled, slanted, flat)",
    options: {
      list: { type: "boolean", short: "l", help: "list all available cap styles" },
    },
    run: (arg, opts) => capsCommand(arg, opts),
  },
  {
    name: "gradient",
    arg: "[name]",
    description:
      "View or set a gradient across each row (a preset, hex colors like #ff5f6d-#ffc371, or off)",
    options: {
      list: { type: "boolean", short: "l", help: "list all gradient presets with a preview" },
    },
    run: (arg, opts) => gradientCommand(arg, opts),
  },
  {
    name: "export",
    arg: "[file]",
    description: "Write your config to a file (or to stdout without one) to back it up or share it",
    options: {
      force: { type: "boolean", help: "replace the file if it already exists" },
    },
    run: (arg, opts) => exportCommand(arg, opts),
  },
  {
    name: "import",
    arg: "<file>",
    description: "Load a config from a file, after showing what changes",
    options: {
      merge: {
        type: "boolean",
        help: "change only the settings the file has (default: replace the whole config)",
      },
      yes: { type: "boolean", short: "y", help: "apply without asking" },
      "allow-exec": {
        type: "boolean",
        help: "accept the shell commands (exec widgets) the file adds; --yes alone doesn't",
      },
    },
    run: (arg, opts) => importCommand(arg, opts),
  },
  {
    name: "doctor",
    description:
      "Check install paths, settings, terminal environment, and spawn the statusline command",
    options: {
      markdown: {
        type: "boolean",
        short: "m",
        help: "output system diagnostics in GitHub-ready Markdown format",
      },
    },
    run: (_arg, opts) => doctorCommand(opts),
  },
  {
    name: "report",
    description:
      "Print a privacy-safe report (system info, config summary, problem log) to attach to a GitHub issue",
    options: {
      output: { type: "string", short: "o", help: "write the report to this file instead" },
      clear: { type: "boolean", help: "empty the problem log" },
    },
    run: (_arg, opts) => reportCommand(opts),
  },
  {
    name: "uninstall",
    description: "Remove statusLine from Antigravity settings",
    options: {
      yes: {
        type: "boolean",
        short: "y",
        help: "remove without prompting (also removes a foreign statusLine)",
      },
      delete: {
        type: "boolean",
        help: "also delete the files agy-powerline installed (scripts, config, install.json)",
      },
    },
    run: (_arg, opts) => uninstallCommand(opts),
  },
  {
    name: "render",
    description: "Render a statusline from JSON on stdin (used by Antigravity)",
    options: {
      demo: { type: "boolean", help: "render sample data instead of reading stdin" },
      ascii: { type: "boolean", help: "plain-text caps/joins and no emojis (overrides config)" },
      color: {
        type: "string",
        value: "<mode>",
        help: "truecolor, 256, or none (overrides config and env)",
      },
      preset: { type: "string", value: "<id>", help: "use preset widgets for this render only" },
      layout: {
        type: "string",
        value: "<id>",
        help: "use pills, lines, or classic for this render",
      },
      theme: { type: "string", value: "<id>", help: "use a theme id or dark, light, colorblind" },
      caps: { type: "string", value: "<style>", help: "use round, angled, slanted, or flat" },
      gradient: {
        type: "string",
        value: "<name|colors>",
        help: "use a gradient preset, hex stops, or off",
      },
      language: {
        type: "string",
        value: "<code>",
        help: `use a language for this render (${SUPPORTED_LANGUAGES.join(", ")})`,
      },
      "dump-payload": {
        type: "string",
        value: "<path>",
        help: "save the stdin payload for bug reports (only the fields the bar uses; no email, IDs or paths)",
      },
    },
    run: (_arg, opts) => renderFromStdin({ ...opts, dumpPayload: opts["dump-payload"] }),
  },
];

function findCommand(name) {
  return COMMANDS.find((cmd) => cmd.name === name || cmd.aliases?.includes(name));
}

function optionFlags(name, spec) {
  const short = spec.short ? `-${spec.short}, ` : "    ";
  return `${short}--${name}${spec.value ? ` ${spec.value}` : ""}`;
}

function formatRows(rows) {
  const width = Math.max(...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`).join("\n");
}

function programHelp() {
  const rows = COMMANDS.map((cmd) => {
    const alias = cmd.aliases?.length ? `|${cmd.aliases.join("|")}` : "";
    const usage = `${cmd.name}${alias}${cmd.arg ? ` ${cmd.arg}` : ""}${Object.keys(cmd.options).length ? " [options]" : ""}`;
    return [usage, cmd.description];
  });
  return [
    `Usage: ${NAME} [options] [command]`,
    "",
    DESCRIPTION,
    "",
    "Options:",
    formatRows([
      ["-V, --version", "output the version number"],
      ["-h, --help", "display help for command"],
    ]),
    "",
    "Commands:",
    formatRows(rows),
    "",
    `Themes, docs and the browser configurator: ${SITE_URL}`,
    "",
  ].join("\n");
}

function commandHelp(cmd) {
  const rows = Object.entries(cmd.options).map(([name, spec]) => [
    optionFlags(name, spec),
    spec.help,
  ]);
  rows.push(["-h, --help", "display help for command"]);
  const alias = cmd.aliases?.length ? `|${cmd.aliases.join("|")}` : "";
  return [
    `Usage: ${NAME} ${cmd.name}${alias} [options]${cmd.arg ? ` ${cmd.arg}` : ""}`,
    "",
    cmd.description,
    "",
    "Options:",
    formatRows(rows),
    "",
  ].join("\n");
}

function fail(message, hint) {
  console.error(`error: ${message}`);
  if (hint) {
    console.error(hint);
  }
  process.exitCode = 1;
}

async function main(argv) {
  const [first, ...rest] = argv;

  if (first === "-V" || first === "--version") {
    console.log(VERSION);
    return;
  }

  if (first === "-h" || first === "--help" || first === "help") {
    const target = first === "help" && rest[0] ? findCommand(rest[0]) : null;
    process.stdout.write(target ? commandHelp(target) : programHelp());
    return;
  }

  const cmd = findCommand(first);

  if (!cmd) {
    fail(`unknown command '${first}'`, `Run '${NAME} --help' to see available commands.`);
    return;
  }

  const parseOptions = { help: { type: "boolean", short: "h" } };
  for (const [name, spec] of Object.entries(cmd.options)) {
    parseOptions[name] = { type: spec.type, ...(spec.short ? { short: spec.short } : {}) };
  }

  let parsed;

  try {
    parsed = parseArgs({ args: rest, options: parseOptions, allowPositionals: true, strict: true });
  } catch (err) {
    fail(err.message, `Run '${NAME} ${cmd.name} --help' for usage.`);
    return;
  }

  const { help, ...opts } = parsed.values;

  if (help) {
    process.stdout.write(commandHelp(cmd));
    return;
  }

  const maxPositionals = cmd.arg ? 1 : 0;

  if (parsed.positionals.length > maxPositionals) {
    fail(
      `too many arguments for '${cmd.name}'. Expected ${maxPositionals} argument${maxPositionals === 1 ? "" : "s"} but got ${parsed.positionals.length}.`
    );
    return;
  }

  await cmd.run(parsed.positionals[0], opts);
}

function renderOverrides(options = {}) {
  return { ascii: options.ascii, color: options.color };
}

function dumpPayloadIfRequested(rawInput, dumpOption, installDir) {
  const target =
    dumpOption ||
    dumpTarget(process.env.AGY_POWERLINE_DUMP_PAYLOAD, installDir) ||
    (process.env.AGY_POWERLINE_DEBUG ? path.join(installDir, "last-payload.json") : null);
  if (target && typeof target === "string") {
    // Only the fields the bar renders, never personal ones.
    writePayloadDump(target, rawInput);
  }
}

// The same two lines as the theme, layout, preset, caps and gradient commands.
function renderOverrideError(name, value) {
  const [what, list] = {
    theme: ["theme", `Available themes: ${THEME_ORDER.join(", ")}`],
    layout: ["layout", `Available layouts: ${LAYOUT_ORDER.join(", ")}`],
    preset: ["preset", `Available presets: ${PRESET_ORDER.join(", ")}`],
    caps: ["cap style", `Available styles: ${STYLE_ORDER.join(", ")}`],
    gradient: ["gradient", `Available gradients: ${GRADIENT_ORDER.join(", ")}, off`],
    language: ["language", `Available languages: ${SUPPORTED_LANGUAGES.join(", ")}`],
  }[name];
  console.error(`${RED}error${RESET} Unknown ${what} "${stripControl(String(value))}".`);
  console.error(` ${list}`);
  if (name === "gradient") {
    console.error(" Or 2 to 6 hex colors joined by dashes, e.g. #ff5f6d-#ffc371");
  }
  process.exitCode = 1;
}

function renderFromStdin(options = {}) {
  const installDir = resolveInstallDir();
  setConfigDir(installDir);
  const { config: savedConfig, error: configError } = readConfigFile();
  const { config, invalid } = applyRenderOverrides(savedConfig, options);

  if (invalid.length) {
    renderOverrideError(invalid[0], options[invalid[0]]);
    return;
  }

  const overrides = { ...renderOverrides(options), configError };

  if (configError) {
    process.stderr.write(`[agy-powerline] invalid statusline.config.json: ${configError}\n`);
  }

  if (options.demo) {
    process.stdout.write(renderStatusline(sampleData(), config, overrides));
    return;
  }

  const input = fs
    .readFileSync(0, "utf8")
    .replace(/^\uFEFF/, "")
    .trim();

  if (!input) {
    process.exit(0);
  }

  dumpPayloadIfRequested(input, options.dumpPayload, installDir);

  let data;

  try {
    data = JSON.parse(input);
  } catch (err) {
    // Node's message quotes the bad input; only say where it broke.
    process.stderr.write(`[agy-powerline] ${jsonErrorMessage(err.message)} on stdin\n`);
    process.stdout.write("\x1b[31m[agy-powerline: invalid JSON]\x1b[0m\n");
    process.exit(0);
  }

  const exec = isTrustedInstallDir(installDir) ? "run" : "blocked";
  process.stdout.write(renderStatusline(data, config, { ...overrides, exec }));
}

// Logged only into an existing install, and only under our own command names.
function logCliCrash(err, first) {
  try {
    const installDir = resolveInstallDir();
    if (!fs.existsSync(installDir)) {
      return;
    }
    setConfigDir(installDir);
    const { config, error } = readConfigFile();
    setLogDir(installDir, isLogEnabled(error ? null : config));
    logError("CLI_CRASH", err, { command: findCommand(first)?.name || "unknown" });
  } catch {
    // Reporting the crash on stderr below is what matters.
  }
}

const args = process.argv.slice(2);

if (!args.length) {
  if (process.stdin.isTTY) {
    process.stdout.write(programHelp());
  } else {
    renderFromStdin();
  }
} else {
  main(args).catch((err) => {
    logCliCrash(err, args[0]);
    console.error(err);
    process.exit(1);
  });
}
