# AI-Native Traces

APG does not need to explain every phenomenon to humans immediately.

The default loop is:

- AI generates puzzle spaces
- AI solvers leave traces
- AI critics and future evolution tools read those traces
- humans receive translation only when something becomes worth showing

`alien_trace.json` is the first small artifact for that direction.

## What It Is

Each experiment writes:

```txt
experiments/APG-xxxx/alien_trace.json
```

The file is deterministic and compact. It encodes:

- symbol-to-glyph mappings
- rule usage pulses
- common final states as glyph sequences
- top run tapes
- scalar pulses such as score, length, basin count, and run count

This is not meant to be beautiful prose. It is a machine-facing observation layer that later APG agents can compare, cluster, mutate, or translate.

## Human Translation Policy

The trace includes:

```txt
translate_only_if_human_interesting
```

That is the project stance. Human-readable reports are useful, but APG's deeper loop may develop in symbols, tapes, vectors, or other AI-native forms first.

## Influences

- Scrapling suggests keeping external research collection as an optional sidecar with caching, throttling, and respect for site rules.
- Freebuff's `knowledge.md` idea reinforces APG's lightweight context-file pattern, already reflected in `garden_program.md`.
- AutoResearchClaw reinforces multi-stage research loops with logs, gates, and responsible translation rather than premature claims.

## Caution

AI-native traces are not proof and not meaning by themselves. They are compact observatory plates. Any human-facing interpretation should stay separate, cautious, and testable.
