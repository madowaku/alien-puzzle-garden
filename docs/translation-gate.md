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

## Cautions

A translation decision is not proof of importance.

A quiet decision is not failure. It only means the trace can remain AI-native until a later atlas, critic, or evolution loop finds it interesting.
