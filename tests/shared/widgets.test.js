"use strict";

const { LAYOUT_ORDER } = require("../../src/lib/config");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { record } = require("../helpers");
const { renderStatusline, defaultConfig } = require("../../src/lib/shared");
const {
  shortModelName,
  shouldBlink,
  resolveQuotaThresholds,
  limitWidth,
  isValidMaxWidth,
  shortenPath,
  isValidDepth,
  visibleWidth,
} = require("../../src/lib/formatters");
const { buildCustomTheme, THEMES } = require("../../src/lib/themes");
const { buildSegment } = require("../../src/lib/layouts/pills");
const { buildLinesSegment, deriveLinesPalette } = require("../../src/lib/layouts/lines");
const {
  editFields: widgetEditFields,
  MAX_WIDTH_WIDGETS,
  stepNumberField,
} = require("../../src/lib/widget-options");
const { isVisibilityThreshold } = require("../../src/lib/widget-style");

const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8"));

function render(data, widgets, options = {}) {
  return strip(
    renderStatusline(
      { ...data, terminal_width: options.width ?? 0 },
      {
        ...defaultConfig(),
        layout: options.layout || "pills",
        ascii: options.ascii,
        widgets,
        ...(options.clock ? { clock: options.clock } : {}),
      },
      { color: options.color || "none" }
    )
  );
}

function withPlatform(platform, wsl, fn) {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const previousWsl = process.env.WSL_DISTRO_NAME;
  const readFileSync = fs.readFileSync;

  Object.defineProperty(process, "platform", { ...platformDescriptor, value: platform });
  if (wsl) {
    process.env.WSL_DISTRO_NAME = "Ubuntu";
  } else {
    delete process.env.WSL_DISTRO_NAME;
  }
  fs.readFileSync = function (file, ...args) {
    if (file === "/proc/version") {
      return "Linux version";
    }
    return readFileSync.call(fs, file, ...args);
  };

  try {
    return fn();
  } finally {
    Object.defineProperty(process, "platform", platformDescriptor);
    if (previousWsl === undefined) {
      delete process.env.WSL_DISTRO_NAME;
    } else {
      process.env.WSL_DISTRO_NAME = previousWsl;
    }
    fs.readFileSync = readFileSync;
  }
}

async function run() {
  testTightestQuota();
  testWidgetThresholds();
  testSplitTokens();
  testShortModel();
  testOneFormPerSetting();
  testTasks();
  testMode();
  testClock();
  testTitle();
  testWidgetWidthAndDepth();
  testOsWidget();
  testHost();
  testCustomLabelAndIcon();
}

function testCustomLabelAndIcon() {
  const real = fixture("antigravity-1.3.0.json");
  const count = (text, part) => text.split(part).length - 1;

  for (const layout of LAYOUT_ORDER) {
    const custom = render(real, [{ id: "fiveHourPct", label: "Quota", icon: "🔋" }], { layout });
    record(
      `${layout} a widget shows its own label and icon`,
      /🔋 Quota: \d/.test(custom) && !/⏳|5h:/.test(custom),
      custom
    );
    const ascii = render(real, [{ id: "fiveHourPct", label: "Quota", icon: "🔋" }], {
      layout,
      ascii: true,
    });
    record(
      `${layout} ASCII mode keeps the label and drops the icon`,
      /Quota: \d/.test(ascii) && !/[^\x00-\x7f]/.test(ascii),
      ascii
    );
    const noName = render(real, [{ id: "fiveHourPct", label: "" }], { layout });
    const noIcon = render(real, [{ id: "fiveHourPct", icon: "" }], { layout });
    record(
      `${layout} an empty label or icon removes it`,
      /⏳ \d/.test(noName) && !/5h:/.test(noName) && /^\W*5h: \d/.test(noIcon.trim()),
      `${noName} | ${noIcon}`
    );
    const iconOnly = render(real, [{ id: "model", label: "Brain" }], { layout });
    record(
      `${layout} an icon-only widget shows a custom label`,
      /🤖 Brain: Gemini/.test(iconOnly),
      iconOnly
    );
    const raw = render(real, [{ id: "fiveHourPct", label: "Quota", icon: "🔋", raw: true }], {
      layout,
    });
    record(
      `${layout} raw mode hides a custom label and icon`,
      !/Quota|🔋/.test(raw) && /\d/.test(raw),
      raw
    );
  }

  const dirty = render(real, [{ id: "fiveHourPct", label: "Qu\u001b[31mota\u0007" }]);
  record(
    "control characters in a label are stripped",
    /Quota: /.test(dirty) && !dirty.includes("\u0007"),
    JSON.stringify(dirty)
  );
  const long = render(real, [{ id: "fiveHourPct", label: "x".repeat(40) }]);
  const longAscii = render(real, [{ id: "fiveHourPct", label: "x".repeat(40) }], { ascii: true });
  record(
    "a 40-character label is cut to 20 columns",
    long.includes(`${"x".repeat(19)}…: `) &&
      !long.includes("x".repeat(20)) &&
      longAscii.includes(`${"x".repeat(17)}...: `),
    `${long} | ${longAscii}`
  );
  const wide = render(real, [{ id: "fiveHourPct", icon: "🔋🔋" }]);
  record(
    "an icon wider than 2 columns is ignored",
    /⏳ 5h: /.test(wide) && !wide.includes("🔋"),
    wide
  );
  // os passes its own icon per system, like the state icons do.
  const state = withPlatform("darwin", false, () => render(real, [{ id: "os", icon: "🧪" }]));
  record(
    "a custom icon wins over a per-state icon",
    /🧪 macOS/.test(state) && !/🍎/.test(state),
    state
  );

  // exec and customText keep their own options and draw them once.
  for (const layout of LAYOUT_ORDER) {
    const exec = render(real, [{ id: "exec", cmd: "echo hi", label: "Node", icon: "⚙" }], {
      layout,
    });
    record(
      `${layout} exec draws its own label and icon once`,
      count(exec, "Node") === 1 && count(exec, "⚙") === 1 && /⚙ Node: \[cmd\]/.test(exec),
      exec
    );
    const badge = render(real, [{ id: "customText", text: "Prod" }], { layout });
    record(`${layout} customText renders as before`, /🏷️ Prod/.test(badge), badge);
  }
}

function testOsWidget() {
  const data = fixture("antigravity-1.3.0.json");
  const widgets = [{ id: "os" }];
  const platforms = [
    ["win32", false, "Windows", "🪟"],
    ["darwin", false, "macOS", "🍎"],
    ["linux", false, "Linux", "🐧"],
    ["linux", true, "WSL", "🐧"],
    ["freebsd", false, "FreeBSD", "💻"],
    ["haiku", false, "haiku", "💻"],
  ];
  const icons = ["🪟", "🍎", "🐧", "💻"];

  for (const [platform, wsl, name, icon] of platforms) {
    withPlatform(platform, wsl, () => {
      for (const layout of LAYOUT_ORDER) {
        const output = render(data, widgets, { layout });
        record(`${layout} os widget shows ${name}`, output.includes(`${icon} ${name}`), output);

        const asciiOutput = render(data, widgets, { layout, ascii: true });
        record(
          `${layout} os widget shows ${name} without emoji in ASCII mode`,
          asciiOutput.includes(name) &&
            icons.every((candidate) => !asciiOutput.includes(candidate)),
          asciiOutput
        );
      }
    });
  }
}

function testHost() {
  const previous = {
    hostname: os.hostname,
    userInfo: os.userInfo,
    user: process.env.USER,
    username: process.env.USERNAME,
  };
  const widgets = [{ id: "host" }];
  const payload = fixture("antigravity-1.3.0.json");
  record("host stays opt-in", !defaultConfig().widgets.some((widget) => widget.id === "host"));

  try {
    // Without a host widget, a refresh asks the OS for neither name.
    let lookups = 0;
    os.hostname = () => {
      lookups++;
      return "devbox";
    };
    os.userInfo = () => {
      lookups++;
      return { username: "alex" };
    };
    render(payload, [{ id: "model" }]);
    record(
      "a bar without host does not look up the user or hostname",
      lookups === 0,
      String(lookups)
    );

    os.hostname = () => "devbox.example.test";
    os.userInfo = () => ({ username: "alex" });
    delete process.env.USER;
    delete process.env.USERNAME;

    for (const layout of LAYOUT_ORDER) {
      const output = render(payload, widgets, { layout });
      record(
        `${layout} host shows the user and short hostname`,
        /alex@devbox/.test(output) && !/example\.test/.test(output),
        output
      );
    }

    os.userInfo = () => {
      throw new Error("no passwd entry");
    };
    process.env.USER = "shell-user";
    record(
      "host falls back to USER when userInfo throws",
      /shell-user@devbox/.test(render(payload, widgets))
    );

    process.env.USER = "";
    process.env.USERNAME = "windows-user";
    record(
      "host falls back to USERNAME when USER is empty",
      /windows-user@devbox/.test(render(payload, widgets))
    );

    delete process.env.USER;
    delete process.env.USERNAME;
    const hostOnly = render(payload, widgets);
    record(
      "host shows only the hostname when no username is available",
      /devbox/.test(hostOnly) && !/@/.test(hostOnly)
    );

    os.hostname = () => {
      throw new Error("hostname unavailable");
    };
    record(
      "host hides when the OS cannot provide a hostname",
      render(payload, widgets).trim() === ""
    );

    os.hostname = () => "devbox.example.test";
    os.userInfo = () => ({ username: "alex" });
    const ascii = render(payload, widgets, { ascii: true });
    record(
      "host renders without non-ASCII characters in ASCII mode",
      ascii.includes("Host: alex@devbox") && !/[^\x00-\x7f]/.test(ascii),
      ascii
    );

    os.userInfo = () => ({ username: "al\u001b[31mex" });
    os.hostname = () => "devbox\u0007.example.test";
    const clean = renderStatusline(payload, { ...defaultConfig(), widgets }, { color: "none" });
    record(
      "host strips terminal control characters from OS values",
      /alex@devbox/.test(clean) && !clean.includes("\u001b[31m") && !clean.includes("\u0007"),
      JSON.stringify(clean)
    );
  } finally {
    os.hostname = previous.hostname;
    os.userInfo = previous.userInfo;
    if (previous.user === undefined) {
      delete process.env.USER;
    } else {
      process.env.USER = previous.user;
    }
    if (previous.username === undefined) {
      delete process.env.USERNAME;
    } else {
      process.env.USERNAME = previous.username;
    }
  }
}

function testTitle() {
  const real = fixture("antigravity-1.3.3-title.json");
  const title = [{ id: "title" }];

  record("title shows the conversation title", /💬 hello /.test(render(real, title)));
  record(
    "lines title shows the conversation title",
    /💬 hello/.test(render(real, title, { layout: "lines" }))
  );

  const long = renderStatusline(
    {
      ...real,
      terminal_width: 0,
      conversation_title: "Refactor the auth\nmiddleware and add \u001b[31mtests for it",
    },
    { ...defaultConfig(), widgets: title },
    { color: "none" }
  );
  record(
    "title is one line without escape sequences, cut to 30 columns",
    /💬 Refactor the auth middleware… /.test(long) && !long.includes("\u001b[31m"),
    JSON.stringify(long)
  );
  record(
    "ASCII title ends a cut with three dots",
    /Refactor the auth middlewar\.\.\. /.test(
      render({ ...real, conversation_title: "Refactor the auth middleware and more" }, title, {
        ascii: true,
      })
    )
  );

  const untitled = { ...real };
  delete untitled.conversation_title;
  record("title hides until the conversation has one", !/💬/.test(render(untitled, title)));
}

function testWidgetWidthAndDepth() {
  const paths = [
    { path: "~/a/b/c/d", shown: "~/…/c/d", ascii: "~/.../c/d" },
    { path: "C:\\x\\y\\z", shown: "C:\\…\\y\\z", ascii: "C:\\...\\y\\z" },
    { path: "/a/b", shown: "/a/b", ascii: "/a/b" },
    { path: "~", shown: "~", ascii: "~" },
    {
      path: "\\\\server\\share\\a\\b\\c",
      shown: "\\\\server\\share\\…\\b\\c",
      ascii: "\\\\server\\share\\...\\b\\c",
    },
  ];
  for (const layout of LAYOUT_ORDER) {
    for (const ascii of [false, true]) {
      for (const { path: cwd, shown, ascii: asciiShown } of paths) {
        const expected = ascii ? asciiShown : shown;
        const output = render(
          { ...fixture("antigravity-1.3.0.json"), cwd },
          [{ id: "cwd", depth: 2 }],
          { layout, ascii }
        );
        record(
          `${layout} cwd depth shortens ${cwd}`,
          output.includes(expected) && (!ascii || !/[^\x00-\x7f]/.test(output)),
          output
        );
      }
    }
  }

  const value = "abcdefghijklmnop";
  const widthWidgets = [
    {
      widget: { id: "cwd", maxWidth: 8 },
      data: { cwd: `/${value}` },
      shown: "/abcdef…",
      ascii: "/abcd...",
    },
    {
      widget: { id: "project", maxWidth: 8 },
      data: { workspace: { project_dir: `/root/${value}` } },
      shown: "abcdefg…",
      ascii: "abcde...",
    },
    {
      widget: { id: "git", maxWidth: 8 },
      data: { vcs: { type: "git", branch: value, dirty: true, ahead: 2, behind: 1 } },
      shown: "abcdefg…",
      ascii: "abcde...",
    },
    {
      widget: { id: "title", maxWidth: 8 },
      data: { conversation_title: value },
      shown: "abcdefg…",
      ascii: "abcde...",
    },
    {
      widget: { id: "model", maxWidth: 8 },
      data: { model: { display_name: value } },
      shown: "abcdefg…",
      ascii: "abcde...",
    },
    {
      widget: { id: "customText", text: value, maxWidth: 8 },
      data: {},
      shown: "abcdefg…",
      ascii: "abcde...",
    },
  ];
  for (const layout of LAYOUT_ORDER) {
    for (const { widget, data, shown, ascii: asciiShown } of widthWidgets) {
      const base = { ...fixture("antigravity-1.3.0.json"), ...data };
      for (const ascii of [false, true]) {
        const expected = ascii ? asciiShown : shown;
        const output = render(base, [widget], { layout, ascii });
        record(
          `${layout} ${widget.id} maxWidth clips to ${expected}`,
          output.includes(expected) && (!ascii || !/[^\x00-\x7f]/.test(output)),
          output
        );
      }
      for (const invalid of [0, -1, "5", 1e9, null]) {
        const output = render(base, [{ ...widget, maxWidth: invalid }], { layout });
        const unchanged = render(base, [{ ...widget, maxWidth: undefined }], { layout });
        record(
          `${layout} ${widget.id} ignores invalid maxWidth ${String(invalid)}`,
          output === unchanged
        );
      }
    }
  }

  record(
    "cwd depth keeps a //server/share root written with forward slashes",
    shortenPath("//server/share/a/b/c", 2) === "//server/share/…/b/c" &&
      shortenPath("//server/share/a/b/c", 2, true) === "//server/share/.../b/c"
  );

  const invalidDepths = [0, -1, "2", 1e9, null];
  for (const layout of LAYOUT_ORDER) {
    const base = { ...fixture("antigravity-1.3.0.json"), cwd: "/a/b/c/d" };
    const original = render(base, [{ id: "cwd" }], { layout });
    for (const depth of invalidDepths) {
      record(
        `${layout} cwd ignores invalid depth ${String(depth)}`,
        render(base, [{ id: "cwd", depth }], { layout }) === original
      );
    }
  }

  for (const layout of LAYOUT_ORDER) {
    const data = {
      ...fixture("antigravity-1.3.0.json"),
      cwd: "/very/long/folders/with/a/name-that-will-not-fit",
    };
    const output = render(data, [{ id: "cwd", depth: 2, maxWidth: 10 }, { id: "model" }], {
      layout,
      width: 40,
    });
    record(
      `${layout} cwd maxWidth applies before terminal fitting`,
      visibleWidth(output) <= 40 && output.includes("…") && /Gemini/.test(output),
      output
    );
  }

  const cjk = limitWidth("A猫BC", { maxWidth: 4 });
  const cjkAscii = limitWidth("A猫BC", { maxWidth: 4 }, true);
  const emoji = limitWidth("A💾BCD", { maxWidth: 5 });
  const emojiAscii = limitWidth("A💾BCDE", { maxWidth: 6 }, true);
  const colored = limitWidth("\x1b[31mabcdefghijkl\x1b[0m", { maxWidth: 8 });
  record(
    "maxWidth counts CJK and emoji as two columns in Unicode and ASCII modes",
    cjk === "A猫…" &&
      cjkAscii === "A..." &&
      emoji === "A💾B…" &&
      emojiAscii === "A💾..." &&
      visibleWidth(cjk) === 4 &&
      visibleWidth(emoji) === 5 &&
      colored === "\x1b[31mabcdefg…\x1b[0m" &&
      visibleWidth(colored) === 8
  );

  const gitSession = {
    git: { branch: value, dirty: true, ahead: 2, behind: 1 },
    exceeds200k: false,
  };
  const gitWidget = { id: "git", maxWidth: 8 };
  const colors = THEMES["dark-aurora"].colors;
  for (const layout of LAYOUT_ORDER) {
    for (const ascii of [false, true]) {
      const output =
        layout === "pills"
          ? buildSegment("git", gitSession, colors, !ascii, ascii, gitWidget, { layout }).text
          : buildLinesSegment(
              "git",
              gitSession,
              deriveLinesPalette(colors),
              !ascii,
              ascii,
              gitWidget,
              { layout, widgets: [gitWidget] }
            );
      const branch = ascii ? "abcde..." : "abcdefg…";
      const marker = layout === "pills" ? (ascii ? `* ${branch}` : `● ${branch}`) : `${branch}*`;
      const sync = ascii ? "^2 v1" : "⇡2 ⇣1";
      record(
        `${layout} git maxWidth clips only the branch, keeping its marker and sync counts`,
        strip(output).includes(marker) && strip(output).includes(sync),
        strip(output)
      );
    }
  }

  // A memo that already holds the output stands in for running the command.
  const execWidget = { id: "exec", cmd: "echo hi", maxWidth: 4 };
  const ranSession = {
    execMode: "run",
    execMemo: { has: () => true, get: () => value, set: () => {} },
    exceeds200k: false,
  };
  for (const layout of LAYOUT_ORDER) {
    const preview = render(fixture("antigravity-1.3.0.json"), [execWidget], { layout });
    record(`${layout} exec maxWidth leaves the [cmd] preview whole`, preview.includes("[cmd]"));
    const ran =
      layout === "pills"
        ? buildSegment("exec", ranSession, colors, true, false, execWidget, { layout }).text
        : buildLinesSegment(
            "exec",
            ranSession,
            deriveLinesPalette(colors),
            true,
            false,
            execWidget,
            {
              layout,
              widgets: [execWidget],
            }
          );
    record(
      `${layout} exec maxWidth clips the command's output`,
      strip(ran).includes("abc…") && !strip(ran).includes(value),
      strip(ran)
    );
  }

  const validWidths = [4, 50, 200];
  const invalidWidths = [0, -1, "5", 1e9, null, NaN, Infinity];
  const validDepth = [1, 10];
  record(
    "maxWidth and depth validate only their documented integer ranges",
    validWidths.every(isValidMaxWidth) &&
      invalidWidths.every((width) => !isValidMaxWidth(width)) &&
      validDepth.every(isValidDepth) &&
      invalidDepths.every((depth) => !isValidDepth(depth)) &&
      invalidWidths.every((width) => limitWidth("value", { maxWidth: width }) === "value") &&
      shortenPath("~/a/b/c", 0) === "~/a/b/c"
  );

  const maxWidthIds = [
    "cwd",
    "project",
    "git",
    "title",
    "model",
    "customText",
    "exec",
    "gitWorktree",
  ];
  const depthField = widgetEditFields({ id: "cwd" }).find(({ key }) => key === "depth");
  const maxWidthField = widgetEditFields({ id: "model" }).find(({ key }) => key === "maxWidth");
  const warnField = widgetEditFields({ id: "fiveHourBar" }).find(({ key }) => key === "warn");
  record(
    "configure exposes Folder depth and a bounded Max width control",
    JSON.stringify([...MAX_WIDTH_WIDGETS].sort()) === JSON.stringify([...maxWidthIds].sort()) &&
      JSON.stringify(depthField?.values) === JSON.stringify([undefined, 1, 2, 3, 4]) &&
      depthField.show(undefined) === "full path" &&
      depthField.show(0) === "full path" &&
      maxWidthField.number === 10 &&
      maxWidthField.step === 5 &&
      maxWidthField.min === 10 &&
      maxWidthField.max === 80 &&
      stepNumberField(maxWidthField, undefined, 1) === 15 &&
      stepNumberField(maxWidthField, 75, 1) === 80 &&
      stepNumberField(maxWidthField, 80, 1) === 80 &&
      stepNumberField(maxWidthField, 10, -1) === 10 &&
      stepNumberField(maxWidthField, "bad", 1) === 15 &&
      stepNumberField(warnField, 30, 1) === 35 &&
      maxWidthField.show(undefined) === "no limit" &&
      maxWidthField.show(201) === "no limit"
  );
}

function testMode() {
  const real = fixture("antigravity-1.3.3-modes.json");
  const mode = [{ id: "mode" }];

  record(
    "mode shows the approval mode and the Vim mode",
    /accept-edits, INSERT/.test(render(real, mode))
  );
  record(
    "lines mode shows the approval mode and the Vim mode",
    /accept-edits, INSERT/.test(render(real, mode, { layout: "lines" }))
  );

  const vimOnly = { ...real };
  delete vimOnly.cycle_mode;
  record("mode shows the Vim mode alone", /🧭 INSERT /.test(render(vimOnly, mode)));

  const approvalOnly = { ...real };
  delete approvalOnly.vim;
  record("mode shows the approval mode alone", /🧭 accept-edits /.test(render(approvalOnly, mode)));

  const neither = { ...vimOnly, cycle_mode: "default" };
  delete neither.vim;
  record("mode hides in the default mode with Vim editing off", !/🧭/.test(render(neither, mode)));
}

function testClock() {
  const real = fixture("antigravity-1.3.0.json");
  const clock = [{ id: "clock" }];
  const time12 = /\b\d{1,2}:\d{2}[ap]m\b/;
  const time24 = /\b\d{2}:\d{2}\b(?![ap]m)/;

  for (const layout of LAYOUT_ORDER) {
    const shown = render(real, clock, { layout });
    record(
      `${layout} clock shows the time after its icon only`,
      /🕒 /.test(shown) && time12.test(shown) && !/Clock:/.test(shown),
      shown
    );
    const ascii = render(real, clock, { layout, ascii: true });
    record(
      `${layout} clock keeps its label in ASCII mode`,
      /Clock: /.test(ascii) && !/[^\x00-\x7f]/.test(ascii),
      ascii
    );
    const h24 = render(real, clock, { layout, clock: { ...defaultConfig().clock, hour12: false } });
    record(`${layout} clock follows the 24-hour setting`, time24.test(h24), h24);
  }
  record("clock stays opt-in", !defaultConfig().widgets.some((widget) => widget.id === "clock"));
}

function testTasks() {
  const real = fixture("antigravity-1.3.3-subagents.json");
  const tasks = [{ id: "tasks" }];

  record(
    "tasks shows running subagents and background tasks",
    /1 subagent, 1 task/.test(render(real, tasks))
  );
  record(
    "lines tasks shows running subagents and background tasks",
    /1 subagent, 1 task/.test(render(real, tasks, { layout: "lines" }))
  );

  // Finished subagents stay in the payload's list; they must not count.
  const mixed = {
    ...real,
    subagents: [{ status: "running" }, { status: "running" }, { status: "completed" }],
    task_count: 3,
  };
  record("tasks counts only running subagents", /2 subagents, 3 tasks/.test(render(mixed, tasks)));

  const idle = { ...real, subagents: [{ status: "completed" }] };
  delete idle.task_count;
  record("tasks hides when nothing runs", render(idle, tasks).trim() === "");
  record(
    "tasks shows background tasks alone",
    /👥 2 tasks /.test(render({ ...idle, task_count: 2 }, tasks))
  );
}

function testTightestQuota() {
  const real = fixture("antigravity-1.3.0.json");
  const quota = [{ id: "quota" }];

  // gemini-weekly (28.6%) is lower than gemini-5h (52.3%); the exhausted 3p
  // bucket belongs to third-party models, not to the Gemini model in use.
  const gemini = render(real, quota);
  record(
    "quota shows the tightest bucket for the Gemini model in use",
    /7d 28\.6% rem/.test(gemini) && /11hr 35m/.test(gemini) && !/3P/.test(gemini),
    gemini
  );

  const claude = render({ ...real, model: { display_name: "Claude Sonnet 4.6" } }, quota);
  record(
    "quota shows the third-party buckets for a non-Gemini model",
    /3P 7d 0\.0% rem/.test(claude),
    claude
  );

  // Google AI Pro sends Argon's own weekly bucket (8.2% left) whatever model
  // is in use; it is not Flash's quota.
  const argonPayload = fixture("antigravity-1.4.0-argon.json");
  const flash = render(argonPayload, quota);
  record(
    "quota leaves the Argon bucket out for other Gemini models",
    /7d 93\.9% rem/.test(flash) && !/Argon|argon/.test(flash),
    flash
  );

  const argonModel = { display_name: "Gemini 4 Argon" };
  const argon = render({ ...argonPayload, model: argonModel }, quota);
  record(
    "quota shows the Argon bucket for an Argon model",
    /Argon 7d 8\.2% rem/.test(argon) && /6d 13h/.test(argon),
    argon
  );

  // Ultra: no Argon bucket, Argon counts toward the Gemini buckets.
  const ultra = render({ ...real, model: argonModel }, quota);
  record(
    "quota uses the Gemini buckets for Argon without an Argon bucket",
    /7d 28\.6% rem/.test(ultra) && !/3P/.test(ultra),
    ultra
  );

  const argonWidgets = [{ id: "argonWeekly" }, { id: "argonReset" }];
  const argonPills = render(argonPayload, argonWidgets);
  record(
    "argonWeekly and argonReset show Argon's own quota whatever the model",
    /🔮 Argon 7d: .*8\.2% rem/.test(argonPills) && /Argon reset: 6d 13h/.test(argonPills),
    argonPills
  );
  const argonLines = render(argonPayload, argonWidgets, { layout: "lines" });
  record(
    "lines argonWeekly and argonReset show Argon's quota and reset",
    /Argon 7d: .*8\.2% rem/.test(argonLines) && /Argon reset: 6d 13h/.test(argonLines),
    argonLines
  );
  for (const layout of LAYOUT_ORDER) {
    const hidden = render(real, argonWidgets, { layout });
    record(`${layout} Argon widgets hide without an Argon bucket`, hidden.trim() === "", hidden);
  }

  const unknown = render(
    {
      model: { display_name: "Gemini 3.8 Flash" },
      quota: { "new-bucket": { remaining_fraction: 0.4 } },
    },
    quota
  );
  record(
    "quota falls back to every bucket when none matches the model",
    /new-bucket 40\.0% rem/.test(unknown),
    unknown
  );

  const disabled = render({ quota: { "3p-5h": { remaining_fraction: 0, disabled: true } } }, quota);
  record("quota hides when every bucket is disabled", disabled.trim() === "", disabled);

  const low = renderStatusline(
    { ...fixture("antigravity-near-limits.json"), terminal_width: 0 },
    { ...defaultConfig(), widgets: quota },
    { color: "truecolor" }
  );
  // dark-aurora danger color #f48771 at 3% left.
  record("quota turns to the danger color when nearly used up", low.includes("2;244;135;113m"));

  const lines = render(real, quota, { layout: "lines" });
  record(
    "lines quota shows the bucket, % left and reset",
    /Quota: 7d 28\.6% rem · 11hr 35m/.test(strip(lines)),
    lines
  );
}

function withRemaining(data, key, remaining) {
  return {
    ...data,
    quota: {
      ...data.quota,
      [key]: {
        ...data.quota?.[key],
        remaining_fraction: remaining / 100,
        reset_in_seconds: 600,
        disabled: false,
      },
    },
  };
}

function withRemainingFor(data, keys, remaining) {
  return keys.reduce((payload, key) => withRemaining(payload, key, remaining), data);
}

function withContextUsed(data, used) {
  return {
    ...data,
    context_window: { ...data.context_window, used_percentage: used },
  };
}

function testWidgetThresholds() {
  const real = fixture("antigravity-1.3.0.json");
  const quotaWidgets = [
    { id: "quota", keys: ["gemini-5h", "gemini-weekly"] },
    { id: "fiveHourBar", keys: ["gemini-5h"] },
    { id: "fiveHourPct", keys: ["gemini-5h"] },
    { id: "weeklyBar", keys: ["gemini-weekly"] },
    { id: "weeklyPct", keys: ["gemini-weekly"] },
    { id: "thirdPartyFiveHour", keys: ["3p-5h"] },
    { id: "thirdPartyWeekly", keys: ["3p-weekly"] },
    { id: "argonWeekly", keys: ["gemini-argon-wtu-weekly"] },
    { id: "fiveHourReset", keys: ["gemini-5h"] },
    { id: "weeklyReset", keys: ["gemini-weekly"] },
    { id: "argonReset", keys: ["gemini-argon-wtu-weekly"] },
  ];

  for (const layout of LAYOUT_ORDER) {
    for (const { id, keys } of quotaWidgets) {
      const widget = { id, showBelow: 50 };
      const above = render(withRemainingFor(real, keys, 60), [widget], { layout });
      const at = render(withRemainingFor(real, keys, 50), [widget], { layout });
      const below = render(withRemainingFor(real, keys, 40), [widget], { layout });
      record(`${layout} ${id} hides above showBelow`, above.trim() === "", above);
      record(`${layout} ${id} shows at showBelow`, at.trim() !== "", at);
      record(`${layout} ${id} shows below showBelow`, below.trim() !== "", below);
    }
  }

  const resetWidgets = [
    { id: "fiveHourReset", own: "gemini-5h", other: "gemini-weekly" },
    { id: "weeklyReset", own: "gemini-weekly", other: "gemini-5h" },
    { id: "argonReset", own: "gemini-argon-wtu-weekly", other: "gemini-weekly" },
  ];
  for (const layout of LAYOUT_ORDER) {
    for (const { id, own, other } of resetWidgets) {
      const ownAbove = withRemaining(withRemaining(real, own, 80), other, 10);
      const ownBelow = withRemaining(withRemaining(real, own, 20), other, 80);
      record(
        `${layout} ${id} follows its own quota when another quota is lower`,
        render(ownAbove, [{ id, showBelow: 50 }], { layout }).trim() === ""
      );
      record(
        `${layout} ${id} appears when its own quota is below the threshold`,
        render(ownBelow, [{ id, showBelow: 50 }], { layout }).trim() !== ""
      );
    }
  }

  const contextWidgets = ["context", "contextPct", "contextTokens"];
  for (const layout of LAYOUT_ORDER) {
    for (const id of contextWidgets) {
      const widget = { id, showAbove: 60 };
      const below = render(withContextUsed(real, 59), [widget], { layout });
      const at = render(withContextUsed(real, 60), [widget], { layout });
      const above = render(withContextUsed(real, 61), [widget], { layout });
      record(`${layout} ${id} hides below showAbove`, below.trim() === "", below);
      record(`${layout} ${id} shows at showAbove`, at.trim() !== "", at);
      record(`${layout} ${id} shows above showAbove`, above.trim() !== "", above);
      const danger = render({ ...withContextUsed(real, 20), exceeds_200k_tokens: true }, [widget], {
        layout,
      });
      record(
        `${layout} ${id} shows past 200k tokens below showAbove`,
        danger.trim() !== "",
        danger
      );
    }
  }

  const invalid = [null, "50", -1, 101, NaN, Infinity];
  record(
    "visibility thresholds accept only finite numeric percentages from 0 to 100",
    [0, 50, 100].every(isVisibilityThreshold) &&
      invalid.every((value) => !isVisibilityThreshold(value))
  );
  for (const layout of LAYOUT_ORDER) {
    for (const value of invalid) {
      record(
        `${layout} invalid showBelow ${String(value)} is ignored`,
        render(withRemaining(real, "gemini-5h", 80), [{ id: "fiveHourPct", showBelow: value }], {
          layout,
        }).trim() !== ""
      );
      record(
        `${layout} invalid showAbove ${String(value)} is ignored`,
        render(withContextUsed(real, 12), [{ id: "contextPct", showAbove: value }], {
          layout,
        }).trim() !== ""
      );
    }
  }

  for (const layout of LAYOUT_ORDER) {
    record(
      `${layout} showBelow accepts the 0% and 100% boundaries`,
      render(withRemaining(real, "gemini-5h", 1), [{ id: "fiveHourPct", showBelow: 0 }], {
        layout,
      }).trim() === "" &&
        render(withRemaining(real, "gemini-5h", 0), [{ id: "fiveHourPct", showBelow: 0 }], {
          layout,
        }).trim() !== "" &&
        render(withRemaining(real, "gemini-5h", 100), [{ id: "fiveHourPct", showBelow: 100 }], {
          layout,
        }).trim() !== ""
    );
    record(
      `${layout} showAbove accepts the 0% and 100% boundaries`,
      render(withContextUsed(real, 0), [{ id: "contextPct", showAbove: 0 }], { layout }).trim() !==
        "" &&
        render(withContextUsed(real, 99), [{ id: "contextPct", showAbove: 100 }], {
          layout,
        }).trim() === "" &&
        render(withContextUsed(real, 100), [{ id: "contextPct", showAbove: 100 }], {
          layout,
        }).trim() !== ""
    );
  }

  for (const layout of LAYOUT_ORDER) {
    const widgets = [
      { id: "model" },
      { id: "separator" },
      { id: "weeklyBar", showBelow: 20 },
      { id: "separator" },
      { id: "git" },
    ];
    const data = {
      ...withRemainingFor(real, ["gemini-5h", "gemini-weekly"], 60),
      vcs: { type: "git", branch: "main", dirty: false },
    };
    const output = render(data, widgets, { layout, ascii: true, color: "truecolor" });
    const expected = render(data, [{ id: "model" }, { id: "separator" }, { id: "git" }], {
      layout,
      ascii: true,
      color: "truecolor",
    });
    record(`${layout} hidden quota widget leaves no extra separator`, output === expected, output);
  }

  for (const { id } of quotaWidgets) {
    const field = widgetEditFields({ id }).find(({ key }) => key === "showBelow");
    record(
      `configure exposes showBelow for ${id}`,
      field?.number === 50 &&
        field.show(undefined) === "always" &&
        field.show(101) === "always" &&
        field.help === "Shows the widget only when this share or less is left."
    );
  }
  for (const id of contextWidgets) {
    const field = widgetEditFields({ id }).find(({ key }) => key === "showAbove");
    record(
      `configure exposes showAbove for ${id}`,
      field?.number === 50 &&
        field.show(undefined) === "always" &&
        field.show(null) === "always" &&
        field.help === "Shows the widget only when this share or more is used."
    );
  }
  record(
    "configure leaves visibility thresholds off unrelated widgets",
    !widgetEditFields({ id: "model" }).some(({ key }) => key === "showBelow" || key === "showAbove")
  );
}

function testSplitTokens() {
  const real = fixture("antigravity-1.3.0.json");
  const split = [{ id: "totalTokens", split: true }];

  record(
    "totalTokens shows the session total by default",
    /478\.2K/.test(render(real, [{ id: "totalTokens" }]))
  );
  record("totalTokens split shows input and output", /123\.1K↑ 355\.0K↓/.test(render(real, split)));
  record(
    "totalTokens split in ASCII mode uses in/out",
    /123\.1K in 355\.0K out/.test(render(real, split, { ascii: true }))
  );
  record(
    "lines totalTokens split shows input and output",
    /123\.1K↑ 355\.0K↓/.test(render(real, split, { layout: "lines" }))
  );
}

function testShortModel() {
  record(
    "shortModelName drops Gemini and joins the variant",
    shortModelName("Gemini 3.8 Flash (High)") === "3.8 Flash·High" &&
      shortModelName("Gemini 3.8 Flash (High)", true) === "3.8 Flash High" &&
      shortModelName("Claude Sonnet 4.6") === "Claude Sonnet 4.6" &&
      shortModelName("Claude Sonnet 4.6 (Thinking)") === "Claude Sonnet 4.6·Thinking"
  );

  const real = fixture("antigravity-1.3.0.json");
  record(
    "model short option shows the short name",
    /3\.8 Flash·High/.test(render(real, [{ id: "model", short: true }]))
  );

  // At 60 columns the first default row only fits once the model name is short.
  const narrow = render(
    { ...real, vcs: { type: "git", branch: "main" } },
    defaultConfig().widgets,
    {
      width: 60,
    }
  );
  record(
    "a narrow terminal shortens the model name before dropping widgets",
    /3\.8 Flash·High/.test(narrow) && !/Gemini 3\.8/.test(narrow),
    narrow
  );
}

// Each setting has one documented form; the other spellings do nothing.
function testOneFormPerSetting() {
  const quotaOnly = (thresholds, widget = {}) => resolveQuotaThresholds(widget, { thresholds });
  record(
    "only quotaWarn/quotaCrit and a widget's warn/crit set quota thresholds",
    quotaOnly({ quotaWarn: 40, quotaCrit: 5 }).warn === 40 &&
      quotaOnly({}, { warn: 25, crit: 3 }).crit === 3 &&
      quotaOnly({ fiveHourWarn: 50, weeklyWarn: 50, warn: 50 }).warn === 30 &&
      quotaOnly({}, { threshold: { warn: 50 } }).warn === 30
  );

  record(
    'blink takes true (danger) and "warn" (caution too); other values never blink',
    shouldBlink("crit", true) &&
      !shouldBlink("warn", true) &&
      shouldBlink("warn", "warn") &&
      shouldBlink("crit", "warn") &&
      !shouldBlink("crit", "crit") &&
      !shouldBlink("crit", "all") &&
      !shouldBlink("crit", "critical")
  );

  const real = fixture("antigravity-1.3.0.json");
  record(
    "customText shows text, ignores label, and hides without text",
    /Ship it/.test(render(real, [{ id: "customText", text: "Ship it" }])) &&
      render(real, [{ id: "customText", label: "Ship it" }]).trim() === ""
  );

  const execOut = renderStatusline(
    { ...real, terminal_width: 0 },
    { ...defaultConfig(), widgets: [{ id: "exec", command: "echo hi" }] }
  );
  record("exec runs cmd only and ignores a command key", strip(execOut).trim() === "");

  const base = THEMES["dark-aurora"].colors.model.join();
  record(
    'customTheme colors are read from "colors" only',
    buildCustomTheme({ colors: { model: "#ff0000" } }).colors.model.join() === "255,0,0" &&
      buildCustomTheme({ model: "#ff0000" }).colors.model.join() === base
  );
}

module.exports = { run };
