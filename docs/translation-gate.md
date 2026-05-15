# Translation Gate

The translation gate decides whether an AI-native trace should be translated for humans.

APG should not explain every trace. The default state is:

```txt
AI observes
AI stores the trace
AI continues
```

Only traces with enough local contrast should produce a short human-facing note.

## Command

```bash
npm run translation-gate
```

Selection options:

```bash
npm run translation-gate -- --latest
npm run translation-gate -- --all
npm run translation-gate -- --experiment APG-0003
```

## Outputs

For every processed experiment:

```txt
translation_gate.json
```

When the gate decides `translate`:

```txt
translation_note.md
```

When the gate decides `do_not_translate`, no note is written. The `alien_trace.json` remains the source artifact.

## Heuristic Signals

The v0.2.12 gate is deterministic and local. It looks for:

- score contrast
- rule pulse concentration
- multiple final-state basins
- dense trace tapes
- enough run glyphs to inspect

## Garden Program Influence

If `garden_program.md` exists, the gate reads it as a light preference layer.

Matched preferences can slightly raise `humanInterestScore`; matched avoid rules can slightly lower it. The influence is recorded in `translation_gate.json` as `gardenInfluence` so the adjustment is inspectable.

This does not override the trace. It only lets the human gardener's current research taste nudge borderline cases.

## Cautions

A translation decision is not proof of importance.

A quiet decision is not failure. It only means the trace can remain AI-native until a later atlas, critic, or evolution loop finds it interesting.
