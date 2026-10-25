// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { LAYOUT_ORDER } = require("../../src/lib/config");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { record, PAYLOAD, stripAnsi } = require("../helpers");
const {
  renderStatusline,
  defaultConfig,
  sampleData,
  renderDotMeter,
  mergeConfig,
} = require("../../src/lib/shared");
const { VALID_WIDGET_IDS } = require("../../src/lib/config");

// Runs fn with the OS reporting the given share of memory in use.
function withMemory(usedShare, fn) {
  const { freemem, totalmem } = os;
  os.totalmem = () => 16 * 1024 ** 3;
  os.freemem = () => 16 * 1024 ** 3 * (1 - usedShare);
  try {
    return fn();
  } finally {
    os.freemem = freemem;
    os.totalmem = totalmem;
  }
}

async function run() {
  const config = {
    ...defaultConfig(),
    widgets: [{ id: "model" }, { id: "cwd" }, { id: "git" }],
  };

  const unixPayload = {
    ...JSON.parse(PAYLOAD),
    cwd: "/home/you/Projects/agy-powerline",
    workspace: {
      current_dir: "/home/you/Projects/agy-powerline",
      project_dir: "/home/you/Projects/agy-powerline",
    },
  };
  const unixOut = renderStatusline(unixPayload, config);
  record(
    "renderer accepts POSIX payload paths",
    /agy-powerline/.test(unixOut) && /Gemini/.test(unixOut)
  );

  const winPayload = JSON.parse(PAYLOAD);
  const winOut = renderStatusline(winPayload, config);
  record(
    "renderer accepts Windows payload paths",
    /agy-powerline/.test(winOut) && /Gemini/.test(winOut)
  );

  // Pills layout rendering test
  const pillsConfig = { ...defaultConfig(), layout: "pills" };
  const pillsOut = renderStatusline(sampleData(), pillsConfig);
  record(
    "renderer renders pills layout with capsules",
    /Gemini/.test(pillsOut) && pillsOut.length > 0
  );

  // Lines layout theme color adaptation test
  const linesOasis = renderStatusline(sampleData(), {
    ...defaultConfig(),
    layout: "lines",
    theme: "dark-ember",
  });
  const linesNightshade = renderStatusline(sampleData(), {
    ...defaultConfig(),
    layout: "lines",
    theme: "light-paper",
  });
  record(
    "Lines layout applies theme colors across different themes",
    linesOasis !== linesNightshade && /Gemini/.test(linesOasis) && /Gemini/.test(linesNightshade)
  );

  // 25-dot meter verification test
  const asciiMeter = renderDotMeter(40, undefined, true);
  const dotCount = (asciiMeter.match(/[#-]/g) || []).length;
  record("Lines layout renders 25-dot meters by default", dotCount === 25);

  // exceeds_200k_tokens test
  const over200kOut = renderStatusline(
    { ...sampleData(), exceeds_200k_tokens: true },
    { ...defaultConfig(), layout: "lines" }
  );
  record("Lines layout highlights >200k context threshold", />200k/.test(over200kOut));

  // Sandbox network security state tests
  const sandboxNet = renderStatusline(
    { ...sampleData(), sandbox: { enabled: true, allow_network: true } },
    { ...defaultConfig(), widgets: [{ id: "sandbox" }] }
  );
  record(
    "Pills layout renders sandbox (net) when network is allowed",
    /sandbox\s*\(net\)/.test(sandboxNet)
  );

  const sandboxIso = renderStatusline(
    { ...sampleData(), sandbox: { enabled: true, allow_network: false } },
    { ...defaultConfig(), widgets: [{ id: "sandbox" }] }
  );
  record(
    "Pills layout renders sandbox (isolated) when network is disabled",
    /sandbox\s*\(isolated\)/.test(sandboxIso)
  );

  // RAM widget & alert tests: RAM is measured locally, so the OS is stubbed.
  const pillsRam = withMemory(0.65, () =>
    renderStatusline(sampleData(), { ...defaultConfig(), widgets: [{ id: "ram" }] })
  );
  record("Pills layout renders ram widget", /RAM:\s*65%/.test(pillsRam));

  const linesRamAlert = withMemory(0.92, () =>
    renderStatusline(sampleData(), {
      ...defaultConfig(),
      layout: "lines",
      widgets: [{ id: "ram" }],
    })
  );
  record("Lines layout shows high RAM usage (92%)", /RAM:\s*92%/.test(stripAnsi(linesRamAlert)));

  const ramFromPayload = withMemory(0.3, () =>
    renderStatusline(
      { ...sampleData(), ramPct: 99 },
      { ...defaultConfig(), widgets: [{ id: "ram" }] }
    )
  );
  record("RAM ignores a ramPct field in the payload", /RAM:\s*30%/.test(ramFromPayload));

  // Fixtures tests
  const fixturesDir = path.join(__dirname, "..", "fixtures");
  const fixtureFiles = fs.readdirSync(fixturesDir).filter((file) => file.endsWith(".json"));
  for (const file of fixtureFiles) {
    const fixtureData = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), "utf8"));
    const renderedPills = renderStatusline(fixtureData, { ...defaultConfig(), layout: "pills" });
    const renderedLines = renderStatusline(fixtureData, { ...defaultConfig(), layout: "lines" });
    record(
      `Fixture ${file} renders without error in pills layout`,
      typeof renderedPills === "string" && renderedPills.length > 0
    );
    record(
      `Fixture ${file} renders without error in lines layout`,
      typeof renderedLines === "string" && renderedLines.length > 0
    );
  }

  // Cap styles and separators are covered by the powerline suite.
  const sample = sampleData();

  // Ahead/behind counts come from a real repository: see the git suite.

  // Lines layout configuration & ordering tests
  const orderTestPayload = {
    ...sample,
    model: { display_name: "MyModel" },
    vcs: { branch: "feat-branch" },
  };
  const gitFirstOut = renderStatusline(orderTestPayload, {
    ...defaultConfig(),
    layout: "lines",
    widgets: [{ id: "git" }, { id: "model" }],
  });
  const gitIndex = gitFirstOut.indexOf("feat-branch");
  const modelIndex = gitFirstOut.indexOf("MyModel");
  record(
    "Lines layout displays configured widgets in exact specified order",
    gitIndex !== -1 && modelIndex !== -1 && gitIndex < modelIndex
  );

  const omittedOut = renderStatusline(orderTestPayload, {
    ...defaultConfig(),
    layout: "lines",
    widgets: [{ id: "model" }],
  });
  record(
    "Lines layout omits unconfigured widgets",
    omittedOut.includes("MyModel") &&
      !omittedOut.includes("feat-branch") &&
      !omittedOut.includes("current")
  );

  const multilineOut = renderStatusline(orderTestPayload, {
    ...defaultConfig(),
    layout: "lines",
    widgets: [{ id: "model" }, { id: "lineBreak" }, { id: "git" }],
  });
  record(
    "Lines layout splits rows on lineBreak",
    multilineOut.includes("\n") &&
      multilineOut.split("\n")[0].includes("MyModel") &&
      multilineOut.split("\n")[1].includes("feat-branch")
  );

  // 25-circle meter verification for all meter circle widgets
  for (const widgetId of ["fiveHourBar", "weeklyBar"]) {
    const meterAscii = renderStatusline(sampleData(), {
      ...defaultConfig(),
      layout: "lines",
      ascii: true,
      widgets: [{ id: widgetId }],
    });
    // The pace marker (|) takes one cell; the meter stays 25 wide.
    const circleCount = (meterAscii.match(/[#|-]/g) || []).length;
    record(`Lines layout renders ${widgetId} with 25 meter circles`, circleCount === 25);
  }

  // Inverted fill verification (100% remaining = 0 filled, 0% remaining = all filled)
  const data100 = sampleData();
  data100.quota["gemini-5h"].remaining_fraction = 1.0;
  const ascii100 = renderStatusline(data100, {
    ...defaultConfig(),
    layout: "lines",
    ascii: true,
    widgets: [{ id: "fiveHourBar", pace: false }],
  });
  const filled100 = (ascii100.match(/#/g) || []).length;
  record(
    "Lines layout renders 0 filled circles at 100% remaining",
    filled100 === 0,
    `got ${filled100} filled`
  );

  const data0 = sampleData();
  data0.quota["gemini-5h"].remaining_fraction = 0.0;
  const ascii0 = renderStatusline(data0, {
    ...defaultConfig(),
    layout: "lines",
    ascii: true,
    widgets: [{ id: "fiveHourBar", pace: false }],
  });
  const filled0 = (ascii0.match(/#/g) || []).length;
  record(
    "Lines layout renders 25 filled circles at 0% remaining",
    filled0 === 25,
    `got ${filled0} filled`
  );

  const pillsMeter = (data, ascii) =>
    stripAnsi(
      renderStatusline(
        data,
        {
          ...defaultConfig(),
          layout: "pills",
          ascii,
          widgets: [{ id: "fiveHourBar", pace: false }],
        },
        { color: "none" }
      )
    );
  record(
    "Pills layout renders an empty meter at 100% remaining",
    pillsMeter(data100, true).includes("[------------]")
  );
  record(
    "Pills layout renders a full meter at 0% remaining",
    pillsMeter(data0, true).includes("[############]")
  );
  record(
    "Pills meters have brackets only in ASCII mode",
    !pillsMeter(data100, false).includes("[") && !pillsMeter(data100, false).includes("]")
  );

  // Row gaps: a blank line between rows, in every layout, only when asked for.
  const twoRows = [{ id: "model" }, { id: "lineBreak" }, { id: "fiveHourPct" }];
  const rowLines = (config) =>
    stripAnsi(
      renderStatusline(sampleData(), { ...defaultConfig(), widgets: twoRows, ...config })
    ).split("\n");
  record("Pills rows touch by default", rowLines({}).length === 2);
  const gapped = rowLines({ rowGap: true });
  record(
    "rowGap puts a blank line between Pills rows",
    gapped.length === 3 && gapped[1].trim() === "" && /Gemini/.test(gapped[0]),
    JSON.stringify(gapped)
  );
  const textGaps = LAYOUT_ORDER.filter((layout) => layout !== "pills").map((layout) => [
    rowLines({ layout }),
    rowLines({ rowGap: true, layout }),
  ]);
  record(
    "rowGap puts a blank line between rows in the text layouts too",
    textGaps.every(
      ([plain, gapped]) =>
        plain.length === 2 &&
        gapped.length === 3 &&
        gapped[1].trim() === "" &&
        /Gemini/.test(gapped[0])
    ),
    JSON.stringify(textGaps)
  );
  record("rowGap survives a config round trip", mergeConfig({ rowGap: true }).rowGap === true);

  // Quota widget labels
  const { WIDGET_BY_ID } = require("../../src/lib/catalog");
  record(
    "Catalog labels fiveHourBar as 5h Remaining Bar",
    WIDGET_BY_ID.fiveHourBar?.label === "5h Remaining Bar"
  );
  record(
    "Catalog labels weeklyBar as 7d Remaining Bar",
    WIDGET_BY_ID.weeklyBar?.label === "7d Remaining Bar"
  );

  const pillsQuotaOut = renderStatusline(sampleData(), {
    ...defaultConfig(),
    layout: "pills",
    widgets: [{ id: "fiveHourBar" }],
  });
  record("Pills layout renders quota with rem indicator", pillsQuotaOut.includes("% rem"));

  const linesQuotaOut = renderStatusline(sampleData(), {
    ...defaultConfig(),
    layout: "lines",
    widgets: [{ id: "fiveHourBar" }],
  });
  record("Lines layout renders quota with rem indicator", linesQuotaOut.includes("% rem"));

  // Approach 1 decoupled reset timer verification
  const fiveHourOnlyPills = renderStatusline(sampleData(), {
    ...defaultConfig(),
    layout: "pills",
    widgets: [{ id: "fiveHourBar" }],
  });
  record("Pills layout decouples fiveHour from reset timer", !fiveHourOnlyPills.includes(" in "));

  const fiveHourOnlyLines = renderStatusline(sampleData(), {
    ...defaultConfig(),
    layout: "lines",
    widgets: [{ id: "fiveHourBar" }],
  });
  record("Lines layout decouples fiveHour from reset timer", !fiveHourOnlyLines.includes("🔄"));

  const resetOnlyLines = renderStatusline(sampleData(), {
    ...defaultConfig(),
    layout: "lines",
    widgets: [{ id: "fiveHourReset" }],
  });
  record("Lines layout renders fiveHourReset with countdown", resetOnlyLines.includes("🔄"));

  // Emoji width & terminal bounds verification
  const { visibleWidth } = require("../../src/lib/formatters");
  record(
    "visibleWidth counts wide emojis (⏳, ⌛, ⏱, ⌨, ⭐) as 2 columns",
    visibleWidth("⏳") === 2 &&
      visibleWidth("⌛") === 2 &&
      visibleWidth("⏱") === 2 &&
      visibleWidth("⌨") === 2 &&
      visibleWidth("⭐") === 2
  );
  record(
    "visibleWidth counts Powerline caps as 1 column",
    visibleWidth("") === 1 && visibleWidth("") === 1
  );

  const emojiPillsPayload = { ...sampleData(), terminal_width: 180 };
  const emojiPillsConfig = {
    ...defaultConfig(),
    layout: "pills",
    powerline: { enabled: false },
    emojis: true,
    ascii: false,
    // Flex Separators stretch the row to the full width, so the measured
    // width must come out exactly at the terminal's.
    widgets: [
      { id: "model" },
      { id: "separator" },
      { id: "fiveHourBar" },
      { id: "fiveHourReset" },
      { id: "separator" },
      { id: "weeklyBar" },
      { id: "weeklyReset" },
      { id: "separator" },
      { id: "ram" },
    ],
  };
  const emojiPillsOut = renderStatusline(emojiPillsPayload, emojiPillsConfig);
  const firstLine = emojiPillsOut.split("\n")[0];
  const renderedWidth = visibleWidth(firstLine);
  record(
    "Pills layout does not exceed terminal_width with wide emojis",
    renderedWidth === 180,
    `expected 180, got ${renderedWidth}`
  );

  // Antigravity sends no data for these, so they were dropped. A config that
  // still lists them must keep rendering the widgets that remain.
  const unknown = ["not-a-widget", "Model", ""];
  const withUnknown = mergeConfig({
    widgets: [...unknown.map((id) => ({ id })), { id: "model" }],
  });
  record(
    "unknown widget ids in a config are skipped and the rest still renders",
    unknown.every((id) => !VALID_WIDGET_IDS.has(id)) &&
      withUnknown.widgets.length === 1 &&
      /Gemini/.test(renderStatusline(sampleData(), withUnknown))
  );

  // Telemetry widgets test (totalTokens, cacheHit, customText)
  const telemetryData = {
    ...sampleData(),
    context_window: {
      ...sampleData().context_window,
      total_input_tokens: 40000,
      total_output_tokens: 10000,
      current_usage: { input_tokens: 2000, output_tokens: 100, cache_read_input_tokens: 8000 },
    },
  };
  const telemetryWidgetsConfig = {
    ...defaultConfig(),
    layout: "pills",
    widgets: [{ id: "totalTokens" }, { id: "cacheHit" }, { id: "customText", text: "Production" }],
  };
  const telemetryPillsOut = renderStatusline(telemetryData, telemetryWidgetsConfig);
  record(
    "Pills layout renders totalTokens, cacheHit, and customText",
    /50\.0k/i.test(telemetryPillsOut) &&
      /80%/i.test(telemetryPillsOut) &&
      /Production/i.test(telemetryPillsOut)
  );

  const telemetryLinesOut = renderStatusline(telemetryData, {
    ...telemetryWidgetsConfig,
    layout: "lines",
  });
  record(
    "Lines layout renders totalTokens, cacheHit, and customText",
    /50\.0k/i.test(telemetryLinesOut) &&
      /80%/i.test(telemetryLinesOut) &&
      /Production/i.test(telemetryLinesOut)
  );

  // agy's used_percentage counts cached tokens (and its own prompt), which
  // input + output tokens leave out: the token count must match the percentage.
  const realPayload = require("../fixtures/antigravity-1.3.0.json");
  const contextOnly = (layout, id = "context") =>
    renderStatusline(realPayload, { ...defaultConfig(), layout, widgets: [{ id }] });
  record(
    "context tokens agree with the percentage beside them (cached tokens included)",
    LAYOUT_ORDER.every(
      (layout) =>
        /123\.1K\/1\.0M \(11\.7%\)/.test(contextOnly(layout)) &&
        /123\.1K\/1\.0M/.test(contextOnly(layout, "contextTokens"))
    )
  );

  const noSize = {
    ...realPayload,
    context_window: { ...realPayload.context_window, context_window_size: undefined },
  };
  const noTotals = {
    ...realPayload,
    context_window: {
      ...realPayload.context_window,
      total_input_tokens: 0,
      total_output_tokens: 0,
    },
  };
  record(
    "without a window size, context tokens count input and cached tokens; totalTokens falls back to the latest request",
    /119\.2K/.test(
      renderStatusline(noSize, { ...defaultConfig(), widgets: [{ id: "contextTokens" }] })
    ) &&
      /5\.3K/.test(
        renderStatusline(noTotals, { ...defaultConfig(), widgets: [{ id: "totalTokens" }] })
      )
  );

  // Exec shell-command widget tests
  const { runExecWidget, clearExecCache } = require("../../src/lib/shared");
  clearExecCache();

  const execPayload = {
    ...JSON.parse(PAYLOAD),
    cwd: process.cwd(),
  };

  const execConfigPills = {
    ...defaultConfig(),
    layout: "pills",
    widgets: [
      { id: "exec", cmd: "node -e \"console.log('stash-5')\"", label: "Stash", icon: "📦" },
    ],
  };
  const execPills = renderStatusline(execPayload, execConfigPills, { exec: "run" });
  record(
    "Pills layout renders exec widget with command output, label, and custom icon",
    /stash-5/.test(execPills) && /Stash/.test(execPills) && /📦/.test(execPills)
  );

  const execConfigLines = {
    ...defaultConfig(),
    layout: "lines",
    widgets: [
      { id: "exec", cmd: "node -e \"console.log('stash-5')\"", label: "Stash", icon: "📦" },
    ],
  };
  const execLines = renderStatusline(execPayload, execConfigLines, { exec: "run" });
  record(
    "Lines layout renders exec widget with command output and label",
    /stash-5/.test(execLines) && /Stash:/.test(execLines) && /📦/.test(execLines)
  );

  // Exec caching verification: subsequent call returns cached value without re-execution
  const cacheTestWidget = {
    id: "exec",
    cmd: 'node -e "console.log(Date.now())"',
    interval: 60,
  };
  const firstVal = runExecWidget(cacheTestWidget, { cwd: process.cwd() });
  const secondVal = runExecWidget(cacheTestWidget, { cwd: process.cwd() });
  record(
    "runExecWidget caches output across calls within interval (zero-spawn)",
    firstVal.length > 0 && firstVal === secondVal
  );

  const execDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-exec-interval-"));
  const previousHome = process.env.AGY_POWERLINE_HOME;
  const originalNow = Date.now;
  let now = originalNow();
  try {
    process.env.AGY_POWERLINE_HOME = execDir;
    fs.writeFileSync(path.join(execDir, "statusline.config.json"), "{}");
    clearExecCache();
    Date.now = () => now;
    const valueFile = path.join(execDir, "value.txt");
    const widget = {
      id: "exec",
      cmd: "node -e \"console.log(require('fs').readFileSync('value.txt', 'utf8'))\"",
      interval: 3600,
    };
    fs.writeFileSync(valueFile, "first");
    const initial = runExecWidget(widget, { cwd: execDir });
    fs.writeFileSync(valueFile, "second");
    now += 5000;
    record(
      "runExecWidget reads a one-hour interval in seconds",
      initial === "first" && runExecWidget(widget, { cwd: execDir }) === "first"
    );
    now += 3594999;
    record(
      "runExecWidget keeps cached output until the full interval has passed",
      runExecWidget(widget, { cwd: execDir }) === "first"
    );
    now += 1;
    record(
      "runExecWidget refreshes output when the interval expires",
      runExecWidget(widget, { cwd: execDir }) === "second"
    );
    widget.interval = 0;
    fs.writeFileSync(valueFile, "third");
    const uncached = runExecWidget(widget, { cwd: execDir });
    fs.writeFileSync(valueFile, "fourth");
    record(
      "runExecWidget does not cache output with interval zero",
      uncached === "third" && runExecWidget(widget, { cwd: execDir }) === "fourth"
    );
  } finally {
    Date.now = originalNow;
    clearExecCache();
    if (previousHome === undefined) delete process.env.AGY_POWERLINE_HOME;
    else process.env.AGY_POWERLINE_HOME = previousHome;
    fs.rmSync(execDir, { recursive: true, force: true });
  }

  // Exec timeout handling: long running command does not hang or throw
  const timeoutWidget = {
    id: "exec",
    cmd: 'node -e "setTimeout(() => {}, 2000)"',
    timeout: 50,
  };
  const timeoutVal = runExecWidget(timeoutWidget, { cwd: process.cwd() });
  record(
    "runExecWidget handles command timeout gracefully without hanging or throwing",
    timeoutVal === ""
  );

  // Exec failure handling: failing command returns empty string
  const failWidget = {
    id: "exec",
    cmd: "non_existent_command_xyz_12345",
    timeout: 200,
  };
  const failVal = runExecWidget(failWidget, { cwd: process.cwd() });
  record("runExecWidget handles failing command gracefully returning empty string", failVal === "");

  clearExecCache();

  // Low-quota / high-context alerts & configurable threshold tests
  const { BLINK } = require("../../src/lib/shared");

  // 1. Quota threshold resolution and color changes
  const quotaSession = {
    ...JSON.parse(PAYLOAD),
    quota: {
      "gemini-5h": { remaining_fraction: 0.18, reset_time: "2026-10-06T18:00:00Z" },
    },
  };

  // With warn threshold 15%, 18% remaining should be healthy (green)
  const quotaCfgHealthy = {
    ...defaultConfig(),
    thresholds: { quotaWarn: 15, quotaCrit: 5 },
    widgets: [{ id: "fiveHourBar" }],
  };
  const quotaHealthyOut = renderStatusline(quotaSession, quotaCfgHealthy);

  // With warn threshold 20%, 18% remaining should trigger warning
  const quotaCfgWarn = {
    ...defaultConfig(),
    thresholds: { quotaWarn: 20, quotaCrit: 5 },
    widgets: [{ id: "fiveHourBar" }],
  };
  const quotaWarnOut = renderStatusline(quotaSession, quotaCfgWarn);

  record(
    "Configurable quota threshold alters alert level and color (warn <20% vs healthy <15%)",
    quotaHealthyOut !== quotaWarnOut
  );

  // 2. High-context threshold customization (e.g. alert >85% context)
  const contextSession = {
    ...JSON.parse(PAYLOAD),
    context_window: {
      used_percentage: 86,
      current_usage: { input_tokens: 86000, output_tokens: 1000 },
    },
  };

  // Default contextCrit is 90% (86% is warning)
  const ctxDefault = renderStatusline(contextSession, {
    ...defaultConfig(),
    widgets: [{ id: "context" }],
  });

  // Custom contextCrit 85% (86% is critical alert)
  const ctxAlert = renderStatusline(contextSession, {
    ...defaultConfig(),
    thresholds: { contextCrit: 85 },
    widgets: [{ id: "context" }],
  });

  record("Configurable context threshold triggers critical alert at >85%", ctxDefault !== ctxAlert);

  // 3. Per-widget threshold overrides
  const widgetOverrideCfg = {
    ...defaultConfig(),
    thresholds: { quotaWarn: 30, quotaCrit: 10 },
    widgets: [{ id: "fiveHourBar", warn: 15, crit: 5 }],
  };
  const widgetOverrideOut = renderStatusline(quotaSession, widgetOverrideCfg);
  record(
    "Per-widget warn/crit thresholds override global config thresholds",
    widgetOverrideOut === quotaHealthyOut
  );

  // 4. Alert blink verification
  const critQuotaSession = {
    ...JSON.parse(PAYLOAD),
    quota: {
      "gemini-5h": { remaining_fraction: 0.05, reset_time: "2026-10-06T18:00:00Z" },
    },
  };

  const blinkCfg = {
    ...defaultConfig(),
    thresholds: { quotaCrit: 10, blink: true },
    widgets: [{ id: "fiveHourBar" }],
  };
  const blinkOut = renderStatusline(critQuotaSession, blinkCfg);
  record(
    "Alert blink emits ANSI blink sequence on critical threshold breach",
    blinkOut.includes(BLINK)
  );

  const noBlinkCfg = {
    ...defaultConfig(),
    thresholds: { quotaCrit: 10, blink: false },
    widgets: [{ id: "fiveHourBar" }],
  };
  const noBlinkOut = renderStatusline(critQuotaSession, noBlinkCfg);
  record("Blink is omitted when blink threshold setting is disabled", !noBlinkOut.includes(BLINK));

  const asciiBlinkCfg = {
    ...defaultConfig(),
    ascii: true,
    thresholds: { quotaCrit: 10, blink: true },
    widgets: [{ id: "fiveHourBar" }],
  };
  const asciiBlinkOut = renderStatusline(critQuotaSession, asciiBlinkCfg);
  record("Blink is suppressed in pure ASCII mode", !asciiBlinkOut.includes(BLINK));

  // 5. Lines layout adapts to thresholds & blink
  const linesAlertOut = renderStatusline(critQuotaSession, {
    ...blinkCfg,
    layout: "lines",
  });
  record(
    "Lines layout renders critical alerts with blink",
    linesAlertOut.includes(BLINK) && /5\.0% rem/.test(stripAnsi(linesAlertOut))
  );
}

module.exports = { run };
