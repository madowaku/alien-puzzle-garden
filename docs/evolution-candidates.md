# Evolution Parent Candidates

Evolution Parent Candidates is a selection layer for future self-play puzzle evolution.

It reads `experiments/pattern_survival_index.json` and writes:

```txt
experiments/evolution_parent_candidates.json
experiments/evolution_parent_candidates.md
```

## Parent Selection Is Not Proof

Parent selection is only a local signal. It does not prove mathematical importance, novelty, or generality.

The command does not mutate puzzles, run solvers, call LLMs, or use the network. It only classifies pattern names from the survival index.

## Decisions

`promote_to_parent` means a robust candidate passed the configured score and result-count thresholds.

`watchlist` means an unstable candidate is interesting enough to keep observing, but not ready for parent selection.

`rename_or_split` means a fragile candidate may need a narrower name or separation into smaller pattern candidates.

`needs_more_tests` means there is not enough mutation pressure yet.

## Preparing Self-Play Evolution

This report prepares v0.5 by turning survival-index entries into a deterministic queue of possible parents, watchlist items, and naming debts.
