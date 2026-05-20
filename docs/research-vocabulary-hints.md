# Research Vocabulary Hints

Research Vocabulary Hints lightly connect:

```txt
experiments/trace_atlas.json
experiments/research_signal_index.json
```

and write:

```txt
experiments/research_vocabulary_hints.json
experiments/research_vocabulary_hints.md
```

## Purpose

This layer places external vocabulary beside local trace families.

It does not classify an APG trace as a mathematical theory. It only suggests words that may help a future translation note, trace cluster seed, or Fluffy Laboratory Bridge card.

## Command

```bash
npm run research-vocabulary-hints
```

## Cautions

Every hint must be read as:

```txt
translation vocabulary only
```

It is:

- not evidence
- not proof
- not a matched theory
- not a novelty claim

## AI Creole Handoff

The output includes a compact AI Creole handoff block:

```txt
ROLE: VocabularyScout
MODE: cautious
TASK: map_trace_to_possible_terms
GOAL: suggest translation vocabulary only
KEEP: local evidence separate from external vocabulary
NO: claim equivalence or novelty
OUT: research_vocabulary_hints.json
CHECK: all hints are marked speculative
NEXT: translation_note or trace_cluster_seed
```
