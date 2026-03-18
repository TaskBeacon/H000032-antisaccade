# H000032 Antisaccade Task

HTML/browser preview of the canonical `T000032-antisaccade` task built with `psyflow-web`.
The web build keeps the same condition semantics, stage order, and reduced-data meaning, but removes the task-local controller in favor of deterministic helper-based sampling.

## Layout

- `main.ts`: mode-aware orchestration, block scheduling, and app mounting
- `config/config.yaml`: declarative task parameters and participant-facing text
- `src/run_trial.ts`: browser-native trial builder for fixation/cue/gap/response/ITI
- `src/utils.ts`: deterministic trial-spec helper plus summary helpers
- `.github/workflows/notify-psyflow-web.yml`: refreshes the shared runner on pushes to `main`

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

