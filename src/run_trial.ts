import {
  set_trial_context,
  type StimBank,
  type TaskSettings,
  type TrialBuilder,
  type TrialSnapshot
} from "psyflow-web";

import {
  Controller,
  RULE_PRO,
  SIDE_LEFT,
  SIDE_RIGHT
} from "./controller";

interface TrialOutcome {
  response_key: string;
  responded: boolean;
  hit: boolean;
  rt_s: number | null;
  timed_out: boolean;
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getOutcome(snapshot: TrialSnapshot): TrialOutcome | null {
  const value = snapshot.units.trial_outcome?.outcome_payload;
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as TrialOutcome;
}

export function run_trial(
  trial: TrialBuilder,
  condition: string,
  context: {
    settings: TaskSettings;
    stimBank: StimBank;
    controller: Controller;
    block_id: string;
    block_idx: number;
  }
): TrialBuilder {
  const { settings, stimBank, controller, block_id, block_idx } = context;
  const rule = controller.parse_rule(condition);
  const targetSide = controller.sample_target_side();
  const leftKey = normalizeKey(settings.left_key ?? "f");
  const rightKey = normalizeKey(settings.right_key ?? "j");
  const responseKeys = [leftKey, rightKey];
  const correctKey = normalizeKey(controller.expected_key(rule, targetSide, leftKey, rightKey));
  const triggerMap = (settings.triggers ?? {}) as Record<string, unknown>;

  const fixationDuration = controller.sample_duration(settings.fixation_duration, 1.0);
  const cueDuration = controller.sample_duration(settings.cue_duration, 0.5);
  const gapDuration = controller.sample_duration(settings.gap_duration, 0.2);
  const responseDeadline = Math.max(0.1, Number(settings.response_deadline ?? 1.0));
  const itiDuration = controller.sample_duration(settings.iti_duration, 0.6);

  const targetStimId = targetSide === SIDE_LEFT ? "left_target" : "right_target";
  const ruleStimId = rule === RULE_PRO ? "rule_pro" : "rule_anti";

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

  const gap = trial.unit("gap").addStim(stimBank.get("left_anchor")).addStim(stimBank.get("right_anchor"));
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

  const saccadeResponse = trial
    .unit("saccade_response")
    .addStim(stimBank.get("left_anchor"))
    .addStim(stimBank.get("right_anchor"))
    .addStim(stimBank.get(targetStimId));
  set_trial_context(saccadeResponse, {
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
  saccadeResponse
    .captureResponse({
      keys: responseKeys,
      correct_keys: [correctKey],
      duration: responseDeadline,
      response_trigger: {
        [leftKey]: Number(triggerMap.response_left ?? 50),
        [rightKey]: Number(triggerMap.response_right ?? 51)
      },
      timeout_trigger: Number(triggerMap.response_timeout ?? 60)
    })
    .set_state({
      response_key: (snapshot: TrialSnapshot) => normalizeKey(snapshot.units.saccade_response?.response),
      responded: (snapshot: TrialSnapshot) => {
        const key = normalizeKey(snapshot.units.saccade_response?.response);
        return key === leftKey || key === rightKey;
      },
      hit: (snapshot: TrialSnapshot) => {
        const key = normalizeKey(snapshot.units.saccade_response?.response);
        return key === correctKey;
      },
      rt_s: (snapshot: TrialSnapshot) => {
        const rt = Number(snapshot.units.saccade_response?.rt);
        return Number.isFinite(rt) ? rt : null;
      },
      timed_out: (snapshot: TrialSnapshot) => {
        const key = normalizeKey(snapshot.units.saccade_response?.response);
        return key !== leftKey && key !== rightKey;
      }
    })
    .to_dict();

  const trialOutcome = trial.unit("trial_outcome");
  set_trial_context(trialOutcome, {
    trial_id: trial.trial_id,
    phase: "trial_outcome",
    deadline_s: 0,
    valid_keys: [],
    block_id,
    condition_id: rule,
    task_factors: {
      stage: "trial_outcome",
      rule,
      target_side: targetSide,
      block_idx
    },
    stim_id: "trial_outcome"
  });
  trialOutcome
    .show({ duration: 0 })
    .set_state({
      outcome_payload: (snapshot: TrialSnapshot) => {
        const key = normalizeKey(snapshot.units.saccade_response?.response_key);
        const responded = key === leftKey || key === rightKey;
        const rt = Number(snapshot.units.saccade_response?.rt_s);
        const rtS = Number.isFinite(rt) ? rt : null;
        return {
          response_key: responded ? key : "",
          responded,
          hit: responded && key === correctKey,
          rt_s: rtS,
          timed_out: !responded
        } satisfies TrialOutcome;
      }
    });

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
    const outcome = getOutcome(snapshot);
    const responded = outcome?.responded ?? false;
    const hit = outcome?.hit ?? false;
    const rtS = outcome?.rt_s ?? null;
    const timedOut = outcome?.timed_out ?? true;
    helpers.setTrialState("condition", rule);
    helpers.setTrialState("rule", rule);
    helpers.setTrialState("target_side", targetSide);
    helpers.setTrialState("correct_key", correctKey);
    helpers.setTrialState("timed_out", timedOut);
    helpers.setTrialState("saccade_response_response", outcome?.response_key ?? "");
    helpers.setTrialState("saccade_response_rt", rtS);
    helpers.setTrialState("saccade_response_hit", hit);
    helpers.setTrialState("responded", responded);

    controller.record_trial({
      hit,
      rt_s: rtS,
      responded,
      rule,
      target_side: targetSide === SIDE_LEFT ? SIDE_LEFT : SIDE_RIGHT
    });
  });

  return trial;
}
