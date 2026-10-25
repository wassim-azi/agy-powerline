// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

// Collects the styles a page's generated markup needs (the colors of the bar
// demos, swatches, icons) into classes of one stylesheet, so the page carries
// one rule per distinct style instead of a style attribute on every element.

function styleClasses() {
  const names = new Map();
  return {
    // The class for a declaration list such as "color:rgb(1,2,3);font-weight:700".
    cls(style) {
      if (!names.has(style)) names.set(style, `k${names.size.toString(36)}`);
      return names.get(style);
    },
    css() {
      return [...names].map(([style, name]) => `.${name}{${style}}`).join("\n");
    },
  };
}

module.exports = { styleClasses };
