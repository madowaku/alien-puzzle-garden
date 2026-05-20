# Alien Puzzle Garden

AI-only puzzle experiment runner.

Alien Puzzle Garden generates strange symbolic puzzle spaces, lets solvers explore them, observes pattern candidates, mutates them, and tracks whether named patterns survive local mutation pressure.

It is not a human-playable puzzle game yet. It is a local research toy for strange pattern observation.

APG's default stance is AI-native first: AI systems may explore, compare, and mutate traces in forms that are not designed for human readability. Human translation is a later layer for cases that become interesting enough to explain.

## Current Flow

```bash
npm run experiment
npm run critic -- --provider mock
npm run mutation-plan
npm run mutation-run
npm run survival-index
npm run evolution-candidates
npm run naming-debt
npm run garden-status
npm run translation-gate
npm run trace-atlas
npm run research-signals
```

## Local Web Viewer

```bash
npm run viewer
```

Then open:

```txt
http://localhost:4177
```

The viewer is local, read-only, and does not call any LLM or external API.

## Garden Program

`garden_program.md` is the human-written research taste for the garden. It describes which pattern candidates APG should prefer, avoid, split, or promote later.

```bash
npm run garden-status
```

## AI-Native Traces

Each experiment writes `alien_trace.json`, a deterministic machine-facing observation tape. It is not a human explanation; it is an AI-readable trace that can later feed clustering, evolution, or translation.

## Translation Gate

```bash
npm run translation-gate
```

The translation gate reads `alien_trace.json` and decides whether a trace is worth a short human-facing note. Most traces can remain AI-native. If a trace crosses the deterministic human-interest threshold, APG writes `translation_note.md`.

## Trace Atlas

```bash
npm run trace-atlas
```

The Trace Atlas scans experiments and groups AI-native traces by translation decision, recurring reasons, dominant rule pulses, quiet traces, and human-interest candidates.

`garden_program.md` lightly influences translation scoring, so the gardener's current research taste can nudge borderline traces without replacing deterministic evidence.

## Research Signals

```bash
python tools/research_harvester.py
npm run research-signals
```

The Python sidecar writes local JSONL research hints, and APG turns them into `research_signal_index.json` and `research_signal_index.md`. This layer is optional: it does not change deterministic experiment generation, and network collection is reserved for a later explicit opt-in path.

Awesome Math can be used as a local vocabulary seed:

```bash
python tools/research_harvester.py --source awesome-math --input fixtures/awesome-math-sample.md
```

## AI Creole

`AI_CREOLE.md` defines APG's project-local AI Creole dialect: a compact handoff language for AI-to-AI and human-to-AI work notes.

It keeps APG's local terms such as AI-native trace, Translation Gate, Pattern Survival, Naming Debt, Failure-as-specimen, and Fluffy Experiment Card without making the core loop depend on another repository.

## API Strategy

- `mock`: no API key
- `ollama`: local LLM
- `openai`: optional paid provider

## Status

Private experimental project.
