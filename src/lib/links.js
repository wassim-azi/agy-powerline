// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const os = require("os");
const path = require("path");
const { getActiveDepth } = require("./colors");
const { splitGraphemes } = require("./text-width");

function basenameOf(value) {
  if (!value) {
    return "";
  }

  return path.basename(String(value).replace(/[\\/]+$/, ""));
}

function homePath(value) {
  if (!value) {
    return "";
  }

  const input = String(value);
  if (input === "~" || /^~[\\/]/.test(input)) {
    return input;
  }
  const windowsAbsolute = /^[a-z]:[\\/]|^\\\\/i.test(input);
  const posixAbsolute = input.startsWith("/");

  // Payload paths can come from another OS. Preserve absolute paths in that
  // format instead of resolving them relative to this machine's cwd.
  if (
    (windowsAbsolute && process.platform !== "win32") ||
    (posixAbsolute && process.platform === "win32")
  ) {
    return input;
  }

  const resolvePath =
    (process.platform === "win32" ? path.win32?.resolve : path.posix?.resolve) || path.resolve;
  const resolved = resolvePath(input);
  const home = resolvePath(os.homedir());
  const normResolved = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const normHome = process.platform === "win32" ? home.toLowerCase() : home;
  const nextChar = resolved[home.length];
  const hasBoundary =
    normResolved.length === normHome.length || nextChar === "/" || nextChar === "\\";

  if (normResolved.startsWith(normHome) && hasBoundary) {
    return "~" + resolved.slice(home.length);
  }

  return resolved;
}

function isValidDepth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

function parsePathParts(text) {
  let root = "";
  let rest = text;
  let separator = text.match(/[\\/]/)?.[0] || "/";
  // A network share keeps \\server\share (or //server/share) as its root.
  const unc = text.match(/^([\\/]{2}[^\\/]+[\\/][^\\/]+)([\\/])?(.*)$/);
  const drive = text.match(/^([a-z]:)([\\/])(.*)$/i);

  if (unc) {
    root = unc[1];
    separator = unc[2] || separator;
    rest = unc[3];
  } else if (drive) {
    root = drive[1];
    separator = drive[2];
    rest = drive[3];
  } else if (text === "~" || /^~[\\/]/.test(text)) {
    root = "~";
    if (text.length > 1) {
      separator = text[1];
      rest = text.slice(2);
    } else {
      rest = "";
    }
  } else if (text[0] === "/" || text[0] === "\\") {
    root = text[0];
    separator = text[0];
    rest = text.slice(1);
  }

  return {
    root,
    separator,
    folders: rest.split(/[\\/]+/).filter(Boolean),
  };
}

function joinPathParts(root, separator, folders) {
  const joined = folders.join(separator);
  if (!root) {
    return joined;
  }
  if (root === "/" || root === "\\") {
    return `${root}${joined}`;
  }
  return joined ? `${root}${separator}${joined}` : root;
}

// Keep the path's root and final `depth` folders, replacing any middle
// folders with one ellipsis. Accept either OS's path separators on every OS.
function shortenPath(value, depth, ascii = false) {
  const text = String(value ?? "");
  if (!text || !isValidDepth(depth)) {
    return text;
  }

  const { root, separator, folders } = parsePathParts(text);
  if (folders.length <= depth) {
    return text;
  }

  const ellipsis = ascii ? "..." : "…";
  return joinPathParts(root, separator, [ellipsis, ...folders.slice(-depth)]);
}

// Abbreviate a single path or branch segment to its first grapheme cluster (or
// dot + first grapheme for hidden names such as ".gemini").
function abbreviateSegment(segment) {
  const clusters = splitGraphemes(segment);
  if (clusters.length <= 1) {
    return segment;
  }
  return segment.startsWith(".") ? clusters.slice(0, 2).join("") : clusters[0];
}

// Fish-style path shortening: abbreviate parent folders while keeping the last
// folder (or `depth` folders when set) in full.
function fishPath(value, depth) {
  const text = String(value ?? "");
  if (!text) {
    return text;
  }

  const keep = isValidDepth(depth) ? depth : 1;
  const { root, separator, folders } = parsePathParts(text);
  if (folders.length <= keep) {
    return text;
  }

  const cutoff = folders.length - keep;
  const shortened = folders.map((folder, index) =>
    index < cutoff ? abbreviateSegment(folder) : folder
  );
  return joinPathParts(root, separator, shortened);
}

// Fish-style branch shortening: abbreviate slash-separated prefixes before the
// final segment (`feature/auth/oauth-login` -> `f/a/oauth-login`).
function fishBranch(value) {
  const text = String(value ?? "");
  if (!text.includes("/")) {
    return text;
  }

  const parts = text.split("/");
  const last = parts.pop();
  return `${parts.map((part) => (part ? abbreviateSegment(part) : "")).join("/")}/${last}`;
}

const SAFE_OSC8_URL = /^(?:https?|file|vscode|cursor|zed):\/\//i;
const PATH_LINK_SCHEMES = new Set([true, "file", "vscode", "cursor", "zed"]);

function encodeUriPath(segments) {
  return segments
    .map((seg) =>
      String(seg).replace(
        /[\s%#?"<>`{}|^\\]/g,
        (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
      )
    )
    .join("/");
}

// Converts an absolute filesystem path into a file:// or editor URI while
// leaving non-ASCII UTF-8 characters unescaped for Windows Explorer / ShellExecute.
function pathLinkUrl(targetPath, option) {
  if (!PATH_LINK_SCHEMES.has(option) || typeof targetPath !== "string") {
    return "";
  }
  const raw = targetPath.trim();
  if (!raw || /[\x00-\x1f\x7f]/.test(raw)) {
    return "";
  }

  let normalized;
  if (/^[A-Za-z]:[\\/]/.test(raw)) {
    normalized = `/${raw[0].toUpperCase()}:${encodeUriPath(raw.slice(2).split(/[\\/]+/))}`;
  } else if (/^\\\\[^\\]+[\\/][^\\]+/.test(raw)) {
    const rest = encodeUriPath(
      raw
        .slice(2)
        .split(/[\\/]+/)
        .filter(Boolean)
    );
    normalized = rest ? `//${rest}` : "";
  } else if (raw.startsWith("/")) {
    normalized = `/${encodeUriPath(raw.slice(1).split(/\/+/))}`;
  } else {
    return "";
  }

  if (!normalized) {
    return "";
  }
  const scheme = option === true || option === "file" ? "file" : option;
  if (scheme === "file") {
    return normalized.startsWith("//") ? `file:${normalized}` : `file://${normalized}`;
  }
  return `${scheme}://file${normalized}`;
}

function isSafeOsc8Url(url) {
  return (
    typeof url === "string" &&
    url.length > 0 &&
    !/[\x00-\x1f\x7f\\]/.test(url) &&
    SAFE_OSC8_URL.test(url)
  );
}

// Wraps visible text in an OSC 8 terminal hyperlink when safe and enabled.
// Suppressed in ASCII mode and no-color mode (NO_COLOR / --color none).
function osc8Link(text, url, { ascii = false } = {}) {
  if (!text || ascii || getActiveDepth() === "none" || !isSafeOsc8Url(url)) {
    return text;
  }
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

function linkPath(text, fullPath, widget, ascii = false) {
  const url = widget?.link ? pathLinkUrl(fullPath, widget.link) : "";
  return osc8Link(text, url, { ascii });
}

function linkGitBranch(text, fullBranch, session, widget, ascii = false) {
  if (
    widget?.link !== true ||
    !fullBranch ||
    !session?.gitDetails?.remoteUrl ||
    (session.gitDetails.detached && session.gitDetails.branch === fullBranch)
  ) {
    return text;
  }
  const encodedBranch = encodeURIComponent(fullBranch).replace(/%2F/g, "/");
  return osc8Link(text, `${session.gitDetails.remoteUrl}/tree/${encodedBranch}`, { ascii });
}

function linkGitSha(sha, session, widget, ascii = false) {
  if (widget?.link !== true || !sha || !session?.gitDetails?.remoteUrl) {
    return sha;
  }
  return osc8Link(sha, `${session.gitDetails.remoteUrl}/commit/${sha}`, { ascii });
}

module.exports = {
  basenameOf,
  homePath,
  isValidDepth,
  shortenPath,
  fishPath,
  fishBranch,
  pathLinkUrl,
  osc8Link,
  linkPath,
  linkGitBranch,
  linkGitSha,
};
