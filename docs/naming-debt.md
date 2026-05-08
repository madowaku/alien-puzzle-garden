# Naming Debt

Naming Debt is the gap between a useful pattern name and the evidence that survived mutation pressure.

The command reads:

```txt
experiments/evolution_parent_candidates.json
experiments/pattern_survival_index.json
```

and writes:

```txt
experiments/naming_debt_report.json
experiments/naming_debt_report.md
```

## A Broken Name Is Useful

A name is not wrong because it breaks. A broken name tells us where the observation was too broad, too local, or under-tested.

`rename_or_split` candidates are naming debt: the label helped enough to test, but the mutation results suggest it should be narrowed.

## Paying Down Naming Debt

Naming debt can be paid down by:

- narrower names
- sharper mutation tests
- splitting one broad pattern into smaller candidates
- collecting more mutation pressure for under-tested candidates

## Preparing Self-Play Evolution

Before self-play evolution chooses parents, APG should know which names are strong enough to promote and which names are still carrying debt.
