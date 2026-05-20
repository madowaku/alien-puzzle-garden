# Trace Cluster Seeds

Trace Cluster Seeds are a deterministic pre-clustering layer.

They group similar APG trace families loosely before APG has a real clustering engine.

## Command

```bash
npm run trace-cluster-seeds
```

Inputs:

```txt
experiments/trace_atlas.json
experiments/research_vocabulary_hints.json
```

Outputs:

```txt
experiments/trace_cluster_seeds.json
experiments/trace_cluster_seeds.md
```

## What Gets Grouped

The first version uses simple deterministic bases:

- same dominant rule-pulse family
- shared translation reasons
- similar human-interest score band
- same translation decision
- overlapping vocabulary hints

This is intentionally not full clustering.

## Why It Exists

Trace Cluster Seeds move APG from single experiments toward trace families.

The next layers can use these seeds for:

- cluster-specific mutation pressure
- surviving trace family checks
- future evolution parent candidate signals
- translation notes that describe trace groups rather than isolated runs

## Cautions

- Cluster seed only; not a proven pattern.
- Vocabulary hints are speculative.
- Trace grouping is deterministic and local, not full clustering.
