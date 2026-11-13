// SPDX-License-Identifier: MIT
// Copyright (c) 2026 agy-powerline contributors

"use strict";

/*
 * Lightweight Core Web Vitals (LCP, CLS, INP) collector using the browser's
 * PerformanceObserver API, reported to GA4 via gtag() with zero dependencies.
 * Callable in Node (for unit tests) and inlined into site pages.
 */

const VITALS_THRESHOLDS = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
};

function rateVital(name, value) {
  const bounds = VITALS_THRESHOLDS[name];
  if (!bounds) return "good";
  if (value <= bounds[0]) return "good";
  if (value <= bounds[1]) return "needs-improvement";
  return "poor";
}

function createClsTracker() {
  let sessionValue = 0;
  let sessionStart = -1;
  let prevTime = -1;
  let maxSession = 0;

  return {
    add(entry) {
      if (!entry || entry.hadRecentInput || typeof entry.value !== "number") return;
      const start = Number(entry.startTime) || 0;
      // CLS groups shifts into sessions separated by >1s gaps, capped at 5s.
      if (sessionStart < 0 || start - prevTime > 1000 || start - sessionStart > 5000) {
        sessionValue = 0;
        sessionStart = start;
      }
      sessionValue += entry.value;
      prevTime = start;
      if (sessionValue > maxSession) maxSession = sessionValue;
    },
    value() {
      return maxSession;
    },
  };
}

function createInpTracker() {
  const byInteraction = Object.create(null);

  return {
    add(entry) {
      if (!entry || !entry.interactionId || typeof entry.duration !== "number") return;
      const id = entry.interactionId;
      const prev = byInteraction[id] || 0;
      if (entry.duration > prev) byInteraction[id] = entry.duration;
    },
    value() {
      const durations = Object.values(byInteraction);
      if (durations.length === 0) return null;
      durations.sort((a, b) => b - a);
      return durations[Math.min(durations.length - 1, Math.floor(durations.length / 50))];
    },
  };
}

function observeEntryType(Observer, type, options, onEntries) {
  if (typeof Observer !== "function") return null;
  if (Array.isArray(Observer.supportedEntryTypes) && !Observer.supportedEntryTypes.includes(type)) {
    return null;
  }
  try {
    const observer = new Observer((list) => {
      if (list && typeof list.getEntries === "function") {
        onEntries(list.getEntries());
      }
    });
    observer.observe({ type, buffered: true, ...options });
    return observer;
  } catch {
    return null;
  }
}

function formatVitalPayload(name, raw) {
  const isCls = name === "CLS";
  return {
    value: isCls ? Math.round(raw * 1000) : Math.round(raw),
    metric_value: isCls ? Number(raw.toFixed(4)) : Math.round(raw),
    metric_rating: rateVital(name, raw),
    non_interaction: true,
    transport_type: "beacon",
  };
}

function initWebVitals(options = {}) {
  const g = typeof globalThis !== "undefined" ? globalThis : {};
  const targetDoc = options.doc !== undefined ? options.doc : g.document || null;
  const targetWin = options.win !== undefined ? options.win : g;
  const Observer = options.Observer !== undefined ? options.Observer : g.PerformanceObserver;
  const report = options.report !== undefined ? options.report : undefined;

  let lcp = null;
  const cls = createClsTracker();
  const inp = createInpTracker();
  const observers = Object.create(null);
  const sent = Object.create(null);

  observers.LCP = observeEntryType(Observer, "largest-contentful-paint", {}, (entries) => {
    for (const entry of entries) {
      if (entry && typeof entry.startTime === "number") lcp = entry.startTime;
    }
  });

  observers.CLS = observeEntryType(Observer, "layout-shift", {}, (entries) => {
    for (const entry of entries) cls.add(entry);
  });

  observers.INP = observeEntryType(Observer, "event", { durationThreshold: 16 }, (entries) => {
    for (const entry of entries) inp.add(entry);
  });

  function getSnapshot() {
    return {
      LCP: lcp,
      CLS: observers.CLS ? cls.value() : null,
      INP: inp.value(),
    };
  }

  function flush() {
    const fn = typeof report === "function" ? report : g.gtag;
    if (typeof fn !== "function") return;
    const snapshot = getSnapshot();
    for (const name of ["LCP", "CLS", "INP"]) {
      const raw = snapshot[name];
      if (raw == null || sent[name]) continue;
      sent[name] = true;
      fn("event", name, formatVitalPayload(name, raw));
      const obs = observers[name];
      if (obs && typeof obs.disconnect === "function") {
        try {
          obs.disconnect();
        } catch {}
      }
    }
  }

  if (targetDoc && typeof targetDoc.addEventListener === "function") {
    targetDoc.addEventListener("visibilitychange", () => {
      if (targetDoc.visibilityState === "hidden") flush();
    });
  }
  if (targetWin && typeof targetWin.addEventListener === "function") {
    targetWin.addEventListener("pagehide", flush);
  }

  return { flush, getSnapshot };
}

const webVitalsApi = {
  VITALS_THRESHOLDS,
  rateVital,
  createClsTracker,
  createInpTracker,
  formatVitalPayload,
  initWebVitals,
};

if (typeof globalThis !== "undefined") {
  globalThis.AgySiteVitals = webVitalsApi;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = webVitalsApi;
}
