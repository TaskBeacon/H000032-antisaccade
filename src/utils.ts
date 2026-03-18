import type { ReducedTrialRow } from "psyflow-web";

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const token = String(value ?? "")
    .trim()
    .toLowerCase();
  return token === "1" || token === "true" || token === "yes" || token === "y";
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(value01: number): string {
  return `${(value01 * 100).toFixed(1)}%`;
}

function summarize(rows: ReducedTrialRow[]): {
  accuracy: string;
  mean_rt_ms: string;
  timeout_count: number;
  total_trials: number;
} {
  if (rows.length === 0) {
    return {
      accuracy: "0.0%",
      mean_rt_ms: "0",
      timeout_count: 0,
      total_trials: 0
    };
  }
  const correctCount = rows.filter((row) => asBool(row.saccade_response_hit)).length;
  const accuracy = formatPercent(correctCount / rows.length);
  const timeoutCount = rows.filter((row) => asBool(row.timed_out)).length;
  const correctRt = rows
    .filter((row) => asBool(row.saccade_response_hit))
    .map((row) => asNumber(row.saccade_response_rt))
    .filter((value): value is number => value != null);
  const meanRtMs = Math.round(mean(correctRt) * 1000).toString();
  return {
    accuracy,
    mean_rt_ms: meanRtMs,
    timeout_count: timeoutCount,
    total_trials: rows.length
  };
}

export function summarizeBlock(rows: ReducedTrialRow[], blockId: string): {
  accuracy: string;
  mean_rt_ms: string;
  timeout_count: number;
  total_trials: number;
} {
  const blockRows = rows.filter((row) => String(row.block_id ?? "") === blockId);
  return summarize(blockRows);
}

export function summarizeOverall(rows: ReducedTrialRow[]): {
  accuracy: string;
  mean_rt_ms: string;
  timeout_count: number;
  total_trials: number;
} {
  return summarize(rows);
}

