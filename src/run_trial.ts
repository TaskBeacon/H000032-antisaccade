import {
  set_trial_context,
  type StimBank,
  type TaskSettings,
  type TrialBuilder
} from "psyflow-web";

import {
  buildAntisaccadeTrialSpec,
  SIDE_LEFT
} from "./utils";

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function run_trial(
  trial: TrialBuilder,
  condition: string,
  context: {
    settings: TaskSettings;
    stimBank: StimBank;
    block_id: string;
    block_idx: number;
    block_seed?: number | null;
  }
): TrialBuilder {
  const { settings, stimBank, block_id, block_idx, block_seed } = context;
  const trialSpec = buildAntisaccadeTrialSpec({
    condition,
    trialId: trial.trial_id,
    blockSeed: block_seed,
    settings
  });
  const rule = String(trialSpec.rule).trim().toLowerCase();
  const targetSide = String(trialSpec.target_side).trim().toLowerCase();

  const leftKey = normalizeKey(trialSpec.left_key);
  const rightKey = normalizeKey(trialSpec.right_key);
  const responseKeys = [leftKey, rightKey];
  const correctKey = normalizeKey(trialSpec.correct_key);

  const fixationDuration = settings.fixation_duration as number | number[];
  const cueDuration = settings.cue_duration as number | number[];
  const gapDuration = settings.gap_duration as number | number[];
  const responseDeadline = settings.response_deadline as number | number[];
  const itiDuration = settings.iti_duration as number | number[];

  const targetStimId = targetSide === SIDE_LEFT ? "left_target" : "right_target";
  const ruleStimId = rule === "prosaccade" ? "rule_pro" : "rule_anti";

  const fixation = trial.unit("fixation").addStim(stimBank.get("fixation"));
  set_trial_context(fixation, {
    trial_id: trial.trial_id,
    phase: "fixation",
    deadline_s: fixationDuration,
    valid_keys: [],
    block_id,
    condition_id: rule,
    task_factors: {
      stage: "fixation",
      rule,
      target_side: targetSide,
      block_idx
    },
    stim_id: "fixation"
  });
  fixation.show({ duration: fixationDuration }).to_dict();

  const ruleCue = trial
    .unit("rule_cue")
    .addStim(stimBank.get(ruleStimId))
    .addStim(stimBank.get("left_anchor"))
    .addStim(stimBank.get("right_anchor"));
  set_trial_context(ruleCue, {
    trial_id: trial.trial_id,
    phase: "rule_cue",
    deadline_s: cueDuration,
    valid_keys: [],
    block_id,
    condition_id: rule,
    task_factors: {
      stage: "rule_cue",
      rule,
      target_side: targetSide,
      block_idx
    },
    stim_id: `${ruleStimId}+left_anchor+right_anchor`
  });
  ruleCue.show({ duration: cueDuration }).to_dict();

  const gap = trial
    .unit("gap")
    .addStim(stimBank.get("left_anchor"))
    .addStim(stimBank.get("right_anchor"));
  set_trial_context(gap, {
    trial_id: trial.trial_id,
    phase: "gap",
    deadline_s: gapDuration,
    valid_keys: [],
    block_id,
    condition_id: rule,
    task_factors: {
      stage: "gap",
      rule,
      target_side: targetSide,
      block_idx
    },
    stim_id: "left_anchor+right_anchor"
  });
  gap.show({ duration: gapDuration }).to_dict();

  const saccade = trial
    .unit("saccade_response")
    .addStim(stimBank.get("left_anchor"))
    .addStim(stimBank.get("right_anchor"))
    .addStim(stimBank.get(targetStimId));
  set_trial_context(saccade, {
    trial_id: trial.trial_id,
    phase: "saccade_response",
    deadline_s: responseDeadline,
    valid_keys: responseKeys,
    block_id,
    condition_id: rule,
    task_factors: {
      stage: "saccade_response",
      rule,
      target_side: targetSide,
      correct_key: correctKey,
      left_key: leftKey,
      right_key: rightKey,
      block_idx
    },
    stim_id: `left_anchor+right_anchor+${targetStimId}`
  });
  saccade
    .captureResponse({
      keys: responseKeys,
      correct_keys: [correctKey],
      duration: responseDeadline,
      response_trigger: null,
      timeout_trigger: null
    })
    .to_dict();

  const iti = trial.unit("iti").addStim(stimBank.get("fixation"));
  set_trial_context(iti, {
    trial_id: trial.trial_id,
    phase: "iti",
    deadline_s: itiDuration,
    valid_keys: [],
    block_id,
    condition_id: rule,
    task_factors: {
      stage: "iti",
      rule,
      target_side: targetSide,
      block_idx
    },
    stim_id: "fixation"
  });
  iti.show({ duration: itiDuration }).to_dict();

  trial.finalize((snapshot, _runtime, helpers) => {
    const snapshotResponse = normalizeKey(snapshot.units.saccade_response?.response);
    const trialResponded = snapshotResponse === leftKey || snapshotResponse === rightKey;
    const trialHit = Boolean(snapshot.units.saccade_response?.hit);
    const trialRtValue = Number(snapshot.units.saccade_response?.rt);
    const trialRtS = Number.isFinite(trialRtValue) ? trialRtValue : null;
    const trialTimedOut = !trialResponded;

    helpers.setTrialState("block_idx", block_idx);
    helpers.setTrialState("rule", rule);
    helpers.setTrialState("target_side", targetSide);
    helpers.setTrialState("correct_key", correctKey);
    helpers.setTrialState("responded", trialResponded);
    helpers.setTrialState("timed_out", trialTimedOut);
    helpers.setTrialState("saccade_response_response", snapshotResponse);
    helpers.setTrialState("saccade_response_rt", trialRtS);
    helpers.setTrialState("saccade_response_hit", trialHit);
  });

  return trial;
}
