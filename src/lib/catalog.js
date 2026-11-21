// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

const { WIDGET_CATALOG } = require("./widgets");

const WIDGET_BY_ID = Object.fromEntries(WIDGET_CATALOG.map((widget) => [widget.id, widget]));

function widgetLabel(id) {
  return WIDGET_BY_ID[id]?.label ?? id;
}

module.exports = {
  WIDGET_CATALOG,
  WIDGET_BY_ID,
  widgetLabel,
};
