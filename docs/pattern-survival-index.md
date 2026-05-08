# Pattern Survival Index

Pattern Survival Index is a cross-experiment summary of how named pattern candidates behaved under local mutation pressure.

It reads `survival_report.json` files, aggregates statuses by pattern name, and writes:

```txt
experiments/pattern_survival_index.json
experiments/pattern_survival_index.md
```

## What It Measures

The index measures only local behavior under the mutation plans that have actually been run.

```txt
survived      = 1.0
weakened      = 0.5
inconclusive  = 0.25
broken        = 0.0
```

The survival score is the average of those weights for a named pattern candidate.

## What It Does Not Measure

This index does not prove a pattern. It does not establish novelty, general mathematical significance, or a real invariant.

It only says that a name was more or less stable under the local mutation pressure currently available.

## Why Fragile Patterns Are Useful

A fragile candidate is not a failed experiment. It marks where the name stopped explaining the traces.

That can suggest a better name, a split into smaller pattern candidates, or a more targeted mutation plan.

## Preparing Self-Play Evolution

Robust candidates can become possible parents for later puzzle evolution. Fragile and unstable candidates can become prompts for better stress tests before selection.
