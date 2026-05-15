# Garden Program

`garden_program.md` is APG's human-written research taste.

It is not executable puzzle logic. It is a small policy document that lets the human gardener describe what kinds of pattern candidates should be preferred, avoided, split, or promoted later.

## Current Use

```bash
npm run garden-status
```

The command reads `garden_program.md` and prints a compact policy summary.

The local viewer also lists `garden_program.md` as a global artifact, so the observatory can display the garden's current research taste next to experiments, survival reports, evolution candidates, and naming debt.

## Future Use

Future self-play evolution can read this file before selecting parents or generating mutation batches.

The intended direction is:

- humans write the garden policy
- APG keeps deterministic experiment logs
- evolution commands use the policy as a local selection hint
- LLM critics may suggest policy changes, but should not silently rewrite the policy

## Caution

The garden program is guidance, not proof. It should shape local exploration without overriding deterministic logs or safety checks.
