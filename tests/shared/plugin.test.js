"use strict";

const fs = require("fs");
const path = require("path");
const { record, runCli } = require("../helpers");
const { WIDGET_CATALOG } = require("../../src/lib/catalog");
const { THEME_ORDER } = require("../../src/lib/themes");

// The agy plugin (`agy plugin install <repo>`): plugin.json and the skills in
// skills/. agy's schema allows no other manifest keys, and the skills tell an
// agent which commands to run, so those commands and flags must exist.
const ROOT = path.join(__dirname, "..", "..");
const SKILLS = path.join(ROOT, "skills");

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    return null;
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([a-z]+):\s*(.*)$/);
    if (pair) {
      fields[pair[1]] = pair[2].trim();
    }
  }
  return fields;
}

// "--yes" and friends for one command, from its --help.
function commandFlags(name) {
  const help = runCli(["help", name]).stdout;
  return new Set([...help.matchAll(/--([a-z-]+)/g)].map((match) => match[1]));
}

async function run() {
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "plugin.json"), "utf8"));
  } catch {
    // Reported below.
  }
  record(
    "plugin.json has exactly $schema, name and description, and a valid name",
    manifest !== null &&
      JSON.stringify(Object.keys(manifest).sort()) ===
        JSON.stringify(["$schema", "description", "name"]) &&
      manifest.$schema === "https://antigravity.google/schemas/v1/plugin.json" &&
      /^[a-zA-Z0-9-_]+$/.test(manifest.name),
    JSON.stringify(manifest)
  );

  const widgets = WIDGET_CATALOG.filter((w) => !["separator", "lineBreak"].includes(w.id)).length;
  const themes = THEME_ORDER.filter((id) => id !== "custom").length;
  record(
    "plugin.json's description counts the widgets and themes there are",
    manifest?.description?.includes(`${widgets} widgets`) &&
      manifest.description.includes(`${themes} themes`),
    `${widgets} widgets, ${themes} themes: ${manifest?.description}`
  );

  const dirs = fs
    .readdirSync(SKILLS)
    .filter((name) => fs.statSync(path.join(SKILLS, name)).isDirectory());
  const bad = [];
  const mentioned = [];
  for (const dir of dirs) {
    const file = path.join(SKILLS, dir, "SKILL.md");
    const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const fields = frontmatter(text);
    if (!fields?.description || fields.name !== dir || !/^[a-z0-9-]+$/.test(dir)) {
      bad.push(dir);
    }
    for (const match of text.matchAll(
      /(?:npx (?:-y )?agy-powerline(?:@latest)?|src\/index\.js) ([a-z]+)([^`\n|]*)/g
    )) {
      mentioned.push({
        skill: dir,
        command: match[1],
        flags: [...match[2].matchAll(/--([a-z-]+)/g)].map((flag) => flag[1]),
      });
    }
  }
  record(
    "every skill has a description and a name equal to its folder",
    dirs.length >= 2 && bad.length === 0,
    bad.join(", ")
  );

  const help = runCli(["--help"]).stdout;
  const commands = new Set(
    [...help.slice(help.indexOf("Commands:")).matchAll(/^ {2}([a-z]+)/gm)].map((m) => m[1])
  );
  const flags = new Map();
  const unknown = mentioned.filter(({ command, flags: used }) => {
    if (!commands.has(command)) {
      return true;
    }
    if (!flags.has(command)) {
      flags.set(command, commandFlags(command));
    }
    return used.some((flag) => !flags.get(command).has(flag));
  });
  record(
    "every command and flag a skill tells the agent to run exists",
    mentioned.length > 5 && unknown.length === 0,
    JSON.stringify(unknown)
  );
}

module.exports = { run };
