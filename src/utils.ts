import type { ReducedTrialRow, TaskSettings } from "psyflow-web";

export const RULE_PRO = "prosaccade";
export const RULE_ANTI = "antisaccade";
export const SIDE_LEFT = "left";
export const SIDE_RIGHT = "right";

export interface AntisaccadeTrialSpec {
  condition: string;
  condition_id: string;
  rule: string;
  target_side: string;
  correct_key: string;
  left_key: string;
  right_key: string;
}

function makeSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseRule(condition: string): string {
  const token = String(condition ?? "")
    .trim()
    .toLowerCase();
  if (token === RULE_PRO || token === RULE_ANTI) {
    return token;
  }
  throw new Error(`Unsupported antisaccade condition: ${condition}`);
}

function trialRng(args: {
  blockSeed?: number | null;
  trialId: number | string;
  condition: string;
}): () => number {
  const base = Number.isFinite(Number(args.blockSeed)) ? Number(args.blockSeed) : 0;
  const rule = parseRule(args.condition);
  const condOffset = rule === RULE_PRO ? 11 : 12;
  const trialId = Number(args.trialId);
  const mixedSeed = (base * 1000003 + trialId * 97 + condOffset) >>> 0;
  return makeSeededRandom(mixedSeed);
}

export function sampleTargetSide(rng: () => number): string {
  return rng() < 0.5 ? SIDE_LEFT : SIDE_RIGHT;
}

export function expectedKey(
  rule: string,
  targetSide: string,
  leftKey: string,
  rightKey: string
): string {
  if (rule === RULE_PRO) {
    return targetSide === SIDE_LEFT ? leftKey : rightKey;
  }
  return targetSide === SIDE_LEFT ? rightKey : leftKey;
}

export function buildAntisaccadeTrialSpec(args: {
  condition: string;
  trialId: number | string;
  blockSeed?: number | null;
  settings: TaskSettings;
}): AntisaccadeTrialSpec {
  const rule = parseRule(args.condition);
  const rng = trialRng({
    blockSeed: args.blockSeed,
    trialId: args.trialId,
    condition: rule
  });
  const targetSide = sampleTargetSide(rng);
  const leftKey = String((args.settings as Record<string, unknown>).left_key ?? "f")
    .trim()
    .toLowerCase();
  const rightKey = String((args.settings as Record<string, unknown>).right_key ?? "j")
    .trim()
    .toLowerCase();
  const correctKey = expectedKey(rule, targetSide, leftKey, rightKey);

  if (Boolean((args.settings as Record<string, unknown>).enable_logging ?? true)) {
    console.debug(
      "[Antisaccade]",
      `condition=${rule}`,
      `trial_id=${String(args.trialId)}`,
      `target_side=${targetSide}`,
      `correct_key=${correctKey}`
    );
  }

  return {
    condition: rule,
    condition_id: rule,
    rule,
    target_side: targetSide,
    correct_key: correctKey,
    left_key: leftKey,
    right_key: rightKey
  };
}

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

function summarize(rows: ReducedTrialRow[]): {
  accuracy: number;
  mean_rt_ms: number;
  timeout_count: number;
  total_trials: number;
} {
  if (rows.length === 0) {
    return {
      accuracy: 0,
      mean_rt_ms: 0,
      timeout_count: 0,
      total_trials: 0
    };
  }
  const correctCount = rows.filter((row) => asBool(row.saccade_response_hit)).length;
  const accuracy = correctCount / rows.length;
  const timeoutCount = rows.filter((row) => asBool(row.timed_out)).length;
  const correctRt = rows
    .filter((row) => asBool(row.saccade_response_hit))
    .map((row) => asNumber(row.saccade_response_rt))
    .filter((value): value is number => value != null);
  const meanRtMs =
    correctRt.length > 0
      ? Math.round(correctRt.reduce((sum, value) => sum + value, 0) / correctRt.length * 1000)
      : 0;
  return {
    accuracy,
    mean_rt_ms: meanRtMs,
    timeout_count: timeoutCount,
    total_trials: rows.length
  };
}

export function summarizeBlock(
  rows: ReducedTrialRow[],
  blockId: string
): {
  accuracy: number;
  mean_rt_ms: number;
  timeout_count: number;
  total_trials: number;
} {
  const blockRows = rows.filter((row) => String(row.block_id ?? "") === blockId);
  return summarize(blockRows);
}

export function summarizeOverall(rows: ReducedTrialRow[]): {
  accuracy: number;
  mean_rt_ms: number;
  timeout_count: number;
  total_trials: number;
} {
  return summarize(rows);
}
