# Mutation Runner

Mutation plans are proposed stress tests for named pattern candidates. The runner executes those tests without calling any LLM or network service.

The command reads `mutation_plan.json`, creates one mutated puzzle per mutation, reruns the standard solver suite, compares the mutated stats with the source experiment, and writes a survival report.

```bash
npm run mutation-run -- --latest
npm run mutation-run -- --all
npm run mutation-run -- --experiment APG-0003
```

## Survival Is Not Proof

`survived`, `weakened`, `broken`, and `inconclusive` are deterministic labels for local comparison only. They do not prove a theorem, establish novelty, or show real mathematical significance.

A pattern candidate becomes more interesting when it remains visible under variation. A broken pattern is also useful because it tells us where the phenomenon was fragile.

## Why Broken Patterns Matter

The goal is not to protect a name. The goal is to test whether the name keeps explaining the traces after the puzzle is changed.

If a mutation breaks the pattern, the stress test worked. That result can guide tighter hypotheses, better names, or future self-play puzzle evolution.
