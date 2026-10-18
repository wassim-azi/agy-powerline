"use strict";

// Builds the plugin archives attached to each GitHub release, for networks
// that block npm or cloning from GitHub: agy-powerline-plugin-<version>.tar.gz
// and .zip, each holding one agy-powerline/ folder that
// `agy plugin install ./agy-powerline` takes. The folder carries src/, so the
// setup skill can run init from it without npm.
// Usage: node scripts/release/plugin-archives.js [<out dir>]   (default: ./dist)
// Prints the two file names, one per line. Needs tar and zip (Linux runners).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repo = path.join(__dirname, "..", "..");
const outDir = path.resolve(process.argv[2] || path.join(repo, "dist"));

// The npm package's files plus what agy reads: plugin.json and skills/.
const FILES = ["plugin.json", "skills", "src", "LICENSE", "CHANGELOG.md"];

const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
const base = `${pkg.name}-plugin-${pkg.version}`;
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "agy-powerline-plugin-"));
const folder = path.join(stage, "agy-powerline");

try {
  fs.mkdirSync(folder);
  const readmes = fs.readdirSync(repo).filter((name) => /^README(\.[\w-]+)?\.md$/.test(name));
  for (const name of [...FILES, ...readmes]) {
    fs.cpSync(path.join(repo, name), path.join(folder, name), { recursive: true });
  }

  // As on npm: "prepare" only turns on git hooks in a clone of the repo.
  if (pkg.scripts) {
    delete pkg.scripts.prepare;
  }
  fs.writeFileSync(path.join(folder, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

  fs.mkdirSync(outDir, { recursive: true });
  const tarball = path.join(outDir, `${base}.tar.gz`);
  const zipfile = path.join(outDir, `${base}.zip`);
  fs.rmSync(tarball, { force: true });
  fs.rmSync(zipfile, { force: true });
  execFileSync("tar", ["-czf", tarball, "-C", stage, "agy-powerline"], { stdio: "inherit" });
  execFileSync("zip", ["-qr", zipfile, "agy-powerline"], { cwd: stage, stdio: "inherit" });
  console.log(`${base}.tar.gz\n${base}.zip`);
} finally {
  // Only the temp folder made above.
  fs.rmSync(stage, { recursive: true, force: true });
}
