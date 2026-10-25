// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

/*
 * The quota pace calculator's math, shared by the page and its tests. Same
 * idea as the bar's pace marker (src/lib/session.js): how far into the quota
 * window you are, from the time left until the reset and the window's length.
 */

(function (root) {
  const WINDOWS = { "5h": 5 * 3600, "7d": 7 * 86400 };

  // Like the bar's reset timers: "2hr 47m", "1d 17h", "12m".
  function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return minutes > 0 ? `${hours}hr ${minutes}m` : `${hours}hr`;
    return `${minutes}m`;
  }

  // window: "5h" or "7d"; leftPct: share of the quota left, 0 to 100;
  // resetIn: seconds until the quota resets.
  function quotaPace({ window: win, leftPct, resetIn }) {
    const length = WINDOWS[win];
    const left = Number(leftPct);
    const reset = Number(resetIn);
    if (!length) return { error: "Pick the 5-hour or the 7-day window." };
    if (!Number.isFinite(left) || left < 0 || left > 100) {
      return { error: "Enter the share left as a number from 0 to 100." };
    }
    if (!Number.isFinite(reset) || reset <= 0) {
      return { error: "Enter the time until the reset." };
    }
    if (reset > length) {
      return {
        error: `A ${win === "5h" ? "5-hour" : "7-day"} quota resets within ${formatDuration(length)}; check the time until the reset.`,
      };
    }

    const elapsed = length - reset;
    const elapsedPct = (elapsed / length) * 100;
    const usedPct = 100 - left;
    // To last until the reset, from now on.
    const budgetPerHour = (left / reset) * 3600;
    const base = { elapsedPct, usedPct, leftPct: left, resetIn: reset, budgetPerHour };

    if (left <= 0) {
      return { ...base, status: "empty", lasts: false, runsOutIn: 0 };
    }
    if (usedPct <= 0 || elapsed <= 0) {
      return { ...base, status: "ahead", lasts: true, leftAtReset: left, ratio: 0 };
    }

    const ratePerSecond = usedPct / elapsed;
    const ratio = usedPct / elapsedPct;
    const runsOutIn = left / ratePerSecond;
    // Using quota no faster than time passes (ratio ≤ 1) is exactly when it
    // lasts until the reset.
    if (runsOutIn >= reset) {
      return {
        ...base,
        status: "ahead",
        lasts: true,
        ratio,
        leftAtReset: Math.max(0, left - ratePerSecond * reset),
      };
    }
    return { ...base, status: "behind", lasts: false, ratio, runsOutIn };
  }

  const api = { WINDOWS, formatDuration, quotaPace };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.AgyQuotaPace = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
