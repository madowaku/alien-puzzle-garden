# APG AI Creole

Project-local AI Creole dialect for Alien Puzzle Garden.

This file follows the AI Creole Dictionary idea: a compact shared work language for human-to-AI and AI-to-AI handoff. The global core should stay small and stable; APG keeps its own local dialect here.

Source influence:

- https://github.com/madowaku/ai-creole-dictionary

## Core Tags Used As-Is

APG uses these stable tags without redefining them:

```txt
ROLE:
MODE:
TASK:
GOAL:
STATE:
CONTEXT:
INPUT:
TARGET:
DO:
KEEP:
NO:
OUT:
CHECK:
RISK:
NEXT:
```

## APG Local Roles

### ROLE: Garden Agent

Use for deterministic APG commands that generate, mutate, index, or classify local artifacts.

### ROLE: Observatory Agent

Use for reading traces, cards, reports, and summaries without claiming proof or novelty.

### ROLE: Laboratory Agent

Use for later focused inspection of candidates that leave the garden through a bridge artifact such as a Fluffy Experiment Card.

### ROLE: Translator Agent

Use for turning selected AI-native traces into cautious human-facing notes.

## APG Local Modes

### MODE: ai_native_first

- keep machine-facing artifacts primary
- translate only after a gate or handoff decision
- do not force every trace into human prose
- preserve compact tapes, glyphs, or structured signals

### MODE: local_first

- prefer deterministic local files
- no network unless explicitly requested
- no API key requirement for the core loop
- keep generated experiment outputs separate from source

### MODE: observatory_note

- distinguish observation from interpretation
- avoid proof, novelty, and broad mathematical claims
- name pattern candidates softly
- include cautions and next tests

### MODE: fluffy_handoff

- keep schema provisional
- carry enough evidence for the next layer
- choose plant, compost, preserve, or escalate
- treat useful failures as specimens

## APG Local Terms

### TERM: AI-native trace

Machine-facing observation artifact such as `alien_trace.json`. It may be compact, symbolic, or not meant for direct human reading.

### TERM: Translation gate

Local deterministic decision about whether a trace deserves a human-facing note.

### TERM: Pattern survival

Local observation of whether a named pattern candidate remains visible under mutation pressure. It is not proof.

### TERM: Naming debt

When a name was useful enough to test, but mutation pressure shows it may be too broad, too local, or under-evidenced.

### TERM: Failure-as-specimen

A broken, malformed, or fragile result preserved because the break itself may teach future garden or laboratory work.

### TERM: Fluffy Experiment Card

Soft handoff memo for carrying a garden phenomenon toward a laboratory layer without turning it into a fixed research claim.

## Example Handoff

```txt
ROLE: Observatory Agent
MODE: observatory_note + ai_native_first
TASK: Read trace_atlas.json and naming_debt_report.json
GOAL: Identify candidates for Fluffy Experiment Cards
KEEP: Local evidence, uncertainty, failure-as-specimen notes
NO: Do not claim proof, novelty, or paper readiness
OUT: Short candidate list with plant / compost / preserve / escalate
CHECK: Each candidate points to source artifacts
NEXT: Generate cards only for candidates with enough local context
```

## Rule

Keep APG AI Creole small. Add local terms only when they reduce real handoff ambiguity between garden, observatory, translation, and laboratory layers.
