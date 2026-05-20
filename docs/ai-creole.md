# AI Creole In APG

AI Creole gives APG a compact handoff language.

The goal is not to make a universal artificial language. The goal is to reduce ambiguity when one AI process leaves work for another AI process, or when a human gardener gives a compact instruction to APG.

APG keeps the canonical dictionary external and stores only its local dialect in:

```txt
AI_CREOLE.md
```

## Why It Fits APG

APG already treats human prose as a later layer:

- `alien_trace.json` can stay AI-native
- `translation_gate.json` decides whether human translation is worth it
- `trace_atlas.json` groups machine-facing traces
- `fluffy-experiment-card.md` sketches a soft garden-to-laboratory bridge

AI Creole gives those layers a small shared protocol for handoff without forcing every artifact to become a human explanation.

## Imported Shape

From the AI Creole Dictionary, APG borrows:

- stable core tags such as `ROLE`, `MODE`, `TASK`, `GOAL`, `STATE`, `TARGET`, `DO`, `KEEP`, `NO`, `OUT`, `CHECK`, `RISK`, and `NEXT`
- reusable mode aliases for work style
- role names for target agents
- the idea that each project may keep a project-local `AI_CREOLE.md`

APG does not vendor the full dictionary. It keeps a local dialect and links back to the source:

```txt
https://github.com/madowaku/ai-creole-dictionary
```

## APG Dialect

The APG dialect focuses on:

- AI-native traces
- local-first operation
- observatory notes
- translation gates
- pattern survival
- naming debt
- fluffy handoff
- failure-as-specimen

These terms should stay soft. They are working handles, not final theory.

## Non-Goals

AI Creole should not:

- replace TypeScript schemas
- make APG depend on another repository at runtime
- force human-readable translation too early
- turn soft garden vocabulary into rigid claims
- make `npm run experiment` require network access, APIs, or LLMs

## Future Use

Later APG commands may emit short AI Creole handoff blocks beside richer JSON artifacts.

Example:

```txt
ROLE: Laboratory Agent
MODE: fluffy_handoff
TASK: Inspect preserved failure-as-specimen cards
TARGET: experiments/fluffy_cards/*.json
NO: Do not claim proof
OUT: Narrow laboratory questions
NEXT: Choose plant / compost / preserve / escalate
```

The JSON artifacts remain the source of truth. AI Creole is the low-friction note pinned to the lab door.
