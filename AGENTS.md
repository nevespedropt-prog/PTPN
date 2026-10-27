# PTPN Working Standard

These instructions are the default for every task in this repository. They record Pedro's standing requirements and must be followed without requiring a reminder.

## Efficiency and credit use

- Work on one clearly scoped change at a time, ordered from most important to least important.
- Inspect the relevant code and current state once, then make the smallest safe change.
- Batch independent reads and status checks when practical. Do not repeatedly read the same files or repeat the same explanation.
- Never enter a tight polling loop. For slow CI, deployment, or external jobs: start the job once, wait for its normal completion window, then check once. If it is still running, report that state and stop unless Pedro explicitly asks to continue waiting.
- Do not rerun the same test or command without a code/configuration change or a new, stated hypothesis.
- If the same approach fails twice, stop, diagnose from evidence, and change strategy. Do not make a third identical attempt.
- Prefer a targeted check while developing. Run the complete suite once when the change is ready. Rerun it only after fixing a real failure.
- Conserve tokens and tool calls. Give short milestone updates only when something changes materially.

## Delivery standard

- Preserve the existing architecture and the gold/charcoal visual language unless Pedro asks for a redesign.
- Check both coach and client experiences whenever a shared feature can affect both.
- Keep navigation state and return paths intact across relevant tabs and pages.
- Do not add payment work and do not modify MYGYM APP.
- Do not claim that something passed, merged, deployed, or is live without checking it once.
- When authorized to implement and deploy, finish the safe end-to-end workflow: edit, targeted verification, one full test run, merge, and one deployment verification.
- If blocked, state the exact blocker and the next action briefly. Do not fill time with repeated status checks.

## Communication standard

- Lead with the result or current blocker.
- Keep updates short, plain, and non-repetitive.
- Do not narrate routine tool use.
- A final update should say what changed, what was verified, whether it is live, and the single best next step.

