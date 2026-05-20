# APG Fluffy Bridge

Conceptual bridge memo for connecting Alien Puzzle Garden with Fluffy Laboratory through small JSON artifacts.

This is not a direct integration plan. It is a shared vocabulary and handoff shape for keeping both tools local-first, inspectable, and loosely coupled.

## Purpose

Alien Puzzle Garden and Fluffy Laboratory should stay separate.

APG is the AI-native strange pattern and puzzle experiment machine. It generates symbolic puzzle spaces, runs solvers, records traces, mutates candidates, and observes whether names survive local pressure.

Fluffy Laboratory is the local-first shelf for pre-research questions, Future Work notes, math memos, daily weirdness, Puzzle Seeds, observations, and useful failures.

The bridge should let a seed or specimen move between the two without forcing either project to become the other.

```txt
Fluffy Laboratory = shelf for questions, observations, specimens, and next hypotheses
Alien Puzzle Garden = experimental garden for symbolic mutation, trace, survival, and pattern discovery
Bridge = JSON membrane for Seed / Trace / Specimen exchange
```

## Shared Vocabulary

### Fluffy Source

Raw material captured before it becomes a Seed.

Examples:

- paper Future Work section
- math note
- blog fragment
- daily observation
- strange phrase or diagram

### Fluffy Seed

A saved research-before-research note in Fluffy Laboratory.

It may be a hypothesis, future work quest, puzzle seed, observation, or plain note.

### Fluffy Puzzle Seed

A Seed that already has puzzle-like structure and may be useful as APG input.

It should carry intent, not executable APG configuration.

### APG Experiment

A generated or configured APG puzzle run.

The first bridge does not need to auto-run experiments. It can produce suggested experiment config only.

### APG Trace

Machine-facing APG observation tape such as `alien_trace.json`.

This remains AI-native unless a translation gate or handoff decision says otherwise.

### APG Pattern Candidate

A soft name or local structure noticed in APG outputs.

It is not proof, not novelty, and not a final mathematical concept.

### APG Survival Result

An observation about whether a pattern candidate survived, weakened, broke, or remained inconclusive under mutation pressure.

### Fluffy Experiment Card

A soft wrapper for carrying an APG or external signal into a laboratory-style micro-experiment.

It is intentionally provisional.

### Failure Specimen

A preserved failure, broken analogy, weird residue, inconclusive result, malformed output, or brittle local pattern that remains worth looking at later.

## Bridge Flow

```txt
Fluffy Laboratory
  Source / Seed / Puzzle Seed
        -> export APG handoff JSON

Alien Puzzle Garden
  import handoff
  suggest experiment config
  optional experiment / trace / mutation / survival / research vocabulary
        -> export Fluffy observation JSON

Fluffy Laboratory
  Observation / Failure Specimen / Next Hypothesis / Puzzle Seed
```

The first version should be file-based.

No direct API coupling is required. No monorepo is required. No runtime dependency should be introduced between the two apps.

## Fluffy To APG Handoff

Fluffy should start with:

```txt
Export APG handoff JSON
```

not:

```txt
Send to APG
```

This keeps the action inspectable and reversible.

Draft shape:

```json
{
  "handoffVersion": "0.1",
  "sourceApp": "fluffy-laboratory",
  "targetApp": "alien-puzzle-garden",
  "cardId": "seed_...",
  "title": "Strange rewrite pattern from a math note",
  "cardType": "puzzle_seed",
  "hypothesis": "A simple local rule may create stable symbolic basins.",
  "materials": {
    "noteMarkdown": "...",
    "sourceUrl": "...",
    "tags": ["math", "rewrite", "puzzle_seed"]
  },
  "apgIntent": {
    "experimentKind": "symbol_rewrite",
    "desiredObservation": "Look for recurring stable pattern candidates.",
    "mutationPressure": "light"
  }
}
```

APG's first importer should only read the file and write an APG-side suggested config or import memo. It should not automatically launch solvers unless a later command explicitly asks for that.

Possible APG-side destination:

```txt
imports/fluffy/
experiments/fluffy_imports/
```

## APG To Fluffy Return

APG should return observations, not verified research results.

Draft shape:

```json
{
  "handoffVersion": "0.1",
  "sourceApp": "alien-puzzle-garden",
  "targetApp": "fluffy-laboratory",
  "cardType": "observation",
  "title": "Pattern survived light mutation pressure",
  "noteMarkdown": "APG observed a recurring basin-like pattern...",
  "tags": ["apg", "observation", "survived", "mutation"],
  "fluffLevel": "medium",
  "verificationStatus": "unverified",
  "nextAction": "plant"
}
```

Useful return modes:

- `interesting_failure`
- `weird_residue`
- `inconclusive`
- `survived_pattern`
- `broken_pattern`

The return artifact should point back to APG source files such as:

- `alien_trace.json`
- `translation_gate.json`
- `trace_atlas.json`
- `research_vocabulary_hints.json`
- `survival_report.json`
- `naming_debt_report.json`

## Handoff Actions

### plant

Use when the artifact should seed another local experiment or become a stronger Puzzle Seed.

### compost

Use when the artifact should dissolve back into the garden as weak learning material.

Compost is not deletion. It means the current shape should not be promoted.

### preserve

Use when the artifact is valuable as a specimen, especially when it failed in an informative way.

### escalate

Use when the artifact deserves a more deliberate laboratory pass, stronger agent, or deeper research workflow.

Escalation should remain rare until the bridge has enough local evidence.

## Failure-As-Specimen

The bridge should keep useful failure visible.

APG can produce broken patterns, brittle names, quiet traces, malformed critic output, and inconclusive mutation results. Fluffy Laboratory is a natural place to preserve those as specimens.

Failure-as-specimen should record:

- what failed
- what pressure exposed the failure
- which APG artifacts support the observation
- why preserving the residue may help later

It should not claim:

- proof
- novelty
- theory match
- paper readiness

## AI Creole Handoff

AI Creole can make the bridge instruction compact.

Example:

```txt
ROLE: BridgeScribe
MODE: fluffy_handoff + local_first
TASK: convert_fluffy_seed_to_apg_handoff
GOAL: write inspectable JSON artifact only
KEEP: source note, tags, uncertainty, local-first boundaries
NO: run APG automatically or claim research value
OUT: apg_handoff.json
CHECK: targetApp is alien-puzzle-garden and cardType is preserved
NEXT: npm run fluffy-import
```

Return example:

```txt
ROLE: BridgeScribe
MODE: observatory_note + fluffy_handoff
TASK: convert_apg_result_to_fluffy_observation
GOAL: preserve useful APG result as a Fluffy observation or failure specimen
KEEP: source artifacts, handoff action, non-claims
NO: mark as verified research
OUT: fluffy_observation.json
CHECK: nextAction is plant / compost / preserve / escalate
NEXT: import into Fluffy Laboratory
```

## Non-Goals

This bridge should not:

- merge the repositories
- make Fluffy depend on APG at runtime
- make APG depend on Fluffy at runtime
- auto-run solvers from Fluffy UI
- treat APG results as verified research
- turn every Seed into an experiment
- skip local JSON inspection
- bypass APG's AI-native trace and translation-gate separation

## Suggested Implementation Order

1. Keep conceptual docs in both repos.
2. Add Fluffy-side `Export APG handoff JSON` for `puzzle_seed`.
3. Add APG-side `npm run fluffy-import` that reads handoff JSON and writes suggested APG config.
4. Add APG-side result summary export for Fluffy.
5. Add Fluffy-side import for APG observation JSON.
6. Add UI affordances after the file loop feels right.

The durable shape is simple:

```txt
separate repos
small JSON artifacts
local-first inspection
failure preserved when useful
```
