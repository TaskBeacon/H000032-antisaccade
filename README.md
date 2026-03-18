# H000032 Antisaccade Task

HTML/browser preview of Antisaccade Task built with `psyflow-web`.
Rule cue, gap, target-side sampling, response-key mapping, and accuracy/RT summary logic are aligned to local `T000032-antisaccade`.

## Layout

- `main.ts`: task orchestration
- `config/config.yaml`: declarative config
- `src/controller.ts`: rule and target sampler with performance counters
- `src/run_trial.ts`: trial logic
- `src/utils.ts`: block/overall summary helpers

## Run

From `e:\xhmhc\TaskBeacon\psyflow-web`:

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:4173/?task=H000032-antisaccade
```

