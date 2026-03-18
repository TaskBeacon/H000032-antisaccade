export const RULE_PRO = "prosaccade";
export const RULE_ANTI = "antisaccade";
export const SIDE_LEFT = "left";
export const SIDE_RIGHT = "right";

function makeSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: unknown, fallback: number): number {
  return Math.round(toNumber(value, fallback));
}

export class Controller {
  readonly fixation_duration: number | number[];
  readonly cue_duration: number | number[];
  readonly gap_duration: number | number[];
  readonly response_deadline: number;
  readonly iti_duration: number | number[];
  readonly enable_logging: boolean;
  readonly random_seed: number | null;
  private readonly random: () => number;
  block_idx: number;
  trial_count_total: number;
  trial_count_block: number;
  correct_total: number;
  correct_block: number;
  timeout_total: number;
  timeout_block: number;
  correct_rt_sum_total: number;
  correct_rt_sum_block: number;
  correct_rt_n_total: number;
  correct_rt_n_block: number;

  constructor(args: {
    fixation_duration?: number | number[];
    cue_duration?: number | number[];
    gap_duration?: number | number[];
    response_deadline?: number;
    iti_duration?: number | number[];
    random_seed?: number | null;
    enable_logging?: boolean;
  }) {
    this.fixation_duration = args.fixation_duration ?? [0.8, 1.2];
    this.cue_duration = args.cue_duration ?? [0.4, 0.6];
    this.gap_duration = args.gap_duration ?? [0.15, 0.25];
    this.response_deadline = Math.max(0.1, toNumber(args.response_deadline, 1.0));
    this.iti_duration = args.iti_duration ?? 0.6;
    this.enable_logging = args.enable_logging !== false;
    this.random_seed =
      args.random_seed == null || Number.isNaN(Number(args.random_seed))
        ? null
        : toInt(args.random_seed, 0);
    this.random = makeSeededRandom(this.random_seed ?? Math.floor(Date.now() % 2147483647));

    this.block_idx = -1;
    this.trial_count_total = 0;
    this.trial_count_block = 0;
    this.correct_total = 0;
    this.correct_block = 0;
    this.timeout_total = 0;
    this.timeout_block = 0;
    this.correct_rt_sum_total = 0;
    this.correct_rt_sum_block = 0;
    this.correct_rt_n_total = 0;
    this.correct_rt_n_block = 0;
  }

  static from_dict(config: Record<string, unknown>): Controller {
    const cfg = config ?? {};
    return new Controller({
      fixation_duration: (cfg.fixation_duration as number | number[] | undefined) ?? [0.8, 1.2],
      cue_duration: (cfg.cue_duration as number | number[] | undefined) ?? [0.4, 0.6],
      gap_duration: (cfg.gap_duration as number | number[] | undefined) ?? [0.15, 0.25],
      response_deadline: toNumber(cfg.response_deadline, 1.0),
      iti_duration: (cfg.iti_duration as number | number[] | undefined) ?? 0.6,
      random_seed: cfg.random_seed == null ? null : toInt(cfg.random_seed, 0),
      enable_logging: Boolean(cfg.enable_logging ?? true)
    });
  }

  start_block(block_idx: number): void {
    this.block_idx = Math.trunc(block_idx);
    this.trial_count_block = 0;
    this.correct_block = 0;
    this.timeout_block = 0;
    this.correct_rt_sum_block = 0;
    this.correct_rt_n_block = 0;
  }

  next_trial_id(): number {
    return this.trial_count_total + 1;
  }

  sample_duration(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, value);
    }
    if (Array.isArray(value) && value.length >= 2) {
      const a = toNumber(value[0], fallback);
      const b = toNumber(value[1], fallback);
      const lower = Math.min(a, b);
      const upper = Math.max(a, b);
      return Math.max(0, lower + (upper - lower) * this.random());
    }
    return Math.max(0, fallback);
  }

  parse_rule(condition: string): string {
    const token = String(condition ?? "")
      .trim()
      .toLowerCase();
    if (token === RULE_PRO || token === RULE_ANTI) {
      return token;
    }
    throw new Error(`Unsupported antisaccade condition: ${condition}`);
  }

  sample_target_side(): string {
    return this.random() < 0.5 ? SIDE_LEFT : SIDE_RIGHT;
  }

  expected_key(rule: string, target_side: string, left_key: string, right_key: string): string {
    if (rule === RULE_PRO) {
      return target_side === SIDE_LEFT ? left_key : right_key;
    }
    return target_side === SIDE_LEFT ? right_key : left_key;
  }

  record_trial(args: {
    hit: boolean;
    rt_s: number | null;
    responded: boolean;
    rule: string;
    target_side: string;
  }): void {
    this.trial_count_total += 1;
    this.trial_count_block += 1;
    if (args.hit) {
      this.correct_total += 1;
      this.correct_block += 1;
      if (args.rt_s != null && Number.isFinite(args.rt_s)) {
        const rt = Math.max(0, Number(args.rt_s));
        this.correct_rt_sum_total += rt;
        this.correct_rt_sum_block += rt;
        this.correct_rt_n_total += 1;
        this.correct_rt_n_block += 1;
      }
    }
    if (!args.responded) {
      this.timeout_total += 1;
      this.timeout_block += 1;
    }
    if (this.enable_logging) {
      console.debug(
        [
          "[Antisaccade]",
          `block=${this.block_idx}`,
          `trial_block=${this.trial_count_block}`,
          `trial_total=${this.trial_count_total}`,
          `rule=${args.rule}`,
          `side=${args.target_side}`,
          `hit=${args.hit}`,
          `responded=${args.responded}`,
          `rt=${args.rt_s}`
        ].join(" ")
      );
    }
  }
}

