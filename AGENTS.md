# Working on Vajefy

Vajefy teaches A1 English vocabulary to Persian speakers. It is an offline-first
PWA on TanStack Start, React 19 and Cloudflare Workers. The roadmap is
[docs/AUTONOMOUS_ASSURANCE_PLAN.md](docs/AUTONOMOUS_ASSURANCE_PLAN.md), and the
scope is A1 only (plan §4 and §32).

## Before you start

1. Read the status ledger in [docs/A1_PLAN_STATUS.md](docs/A1_PLAN_STATUS.md).
   It is the authoritative record of what is done. Do not redo a DONE or
   MACHINE_PASS row. Continue an IN_PROGRESS row from its note.
2. For semantic-assurance work, also read `content/assurance/progress.json`
   (`currentWork`, `doNotRepeat`, `blockers`) and
   [docs/AUTONOMOUS_ASSURANCE_PROGRESS.md](docs/AUTONOMOUS_ASSURANCE_PROGRESS.md).
3. Check the current `main`. Repository evidence beats memory of an earlier
   session.

## When you finish a piece of work

- Update its ledger row in the same pull request: state, first commit,
  evidence and note. After the merge, record the merge commit as the
  completion commit in the next pull request.
- Run `npm run status:check`.
- If you add, remove or switch off a feature, update
  [docs/FEATURES.md](docs/FEATURES.md) and run `npm run features:check`.
- For semantic-assurance work, also update both progress files.

## Never

- Mark Gate 0 cleared without documented redistribution and derivative-work
  rights.
- Fabricate reviewer approvals, listening or device results, learner data, or
  semantic PASS evidence.
- Change frozen calibration thresholds or gold labels after seeing model
  output. Create a new calibration version instead.
- Add push, schedule or repository_dispatch triggers to inference workflows,
  or API-key model providers. Never run paid inference without the owner's
  explicit authorization.
- Raise a ratchet baseline, or skip, disable or quarantine a test to get CI
  green.

## Checks

- `npm run validate:data`, `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build` and `npx playwright test`.
- Content lives in `content/pilot/entries/*.json`. Edit strings in place and
  keep the file formatting. Then run `npm run content:build`,
  `npm run coach:cases` and `npm run validate:data`. CI rejects generated
  content that is out of date.
