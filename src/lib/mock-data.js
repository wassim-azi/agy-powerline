"use strict";

function sampleData() {
  const now = Date.now();
  const fiveHourReset = new Date(now + (2 * 3600 + 47 * 60) * 1000);
  const weeklyReset = new Date(now + (86400 + 17 * 3600) * 1000);

  return {
    cwd: process.cwd(),
    model: {
      id: "Gemini 3.8 Flash (High)",
      display_name: "Gemini 3.8 Flash (High)",
    },
    workspace: {
      current_dir: process.cwd(),
      project_dir: process.cwd(),
    },
    version: "1.2.17",
    context_window: {
      total_input_tokens: 88244,
      total_output_tokens: 61074,
      context_window_size: 1048576,
      used_percentage: 14.24,
      remaining_percentage: 85.76,
      current_usage: {
        input_tokens: 63382,
        output_tokens: 346,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 85935,
      },
    },
    exceeds_200k_tokens: false,
    product: "antigravity",
    quota: {
      "3p-5h": {
        remaining_fraction: 1,
        reset_time: new Date(now + 17890 * 1000).toISOString(),
        reset_in_seconds: 17890,
        disabled: true,
      },
      "3p-weekly": {
        remaining_fraction: 0,
        reset_time: new Date(now + 456682 * 1000).toISOString(),
        reset_in_seconds: 456682,
      },
      "gemini-5h": {
        remaining_fraction: 0.72,
        reset_time: fiveHourReset.toISOString(),
        reset_in_seconds: 2 * 3600 + 47 * 60,
      },
      "gemini-weekly": {
        remaining_fraction: 0.21,
        reset_time: weeklyReset.toISOString(),
        reset_in_seconds: 86400 + 17 * 3600,
      },
    },
    agent_state: "thinking",
    vcs: {
      type: "git",
      branch: "main",
      dirty: true,
    },
    sandbox: { enabled: false },
    artifact_count: 2,
    subagents: [
      { name: "research", role: "Find where the config is loaded", status: "running" },
      { name: "review", role: "Check the error messages", status: "completed" },
    ],
    task_count: 1,
    cycle_mode: "accept-edits",
    conversation_title: "Fix the config loader",
    plan_tier: "Pro",
    terminal_width: process.stdout.columns || 120,
  };
}

module.exports = {
  sampleData,
};
