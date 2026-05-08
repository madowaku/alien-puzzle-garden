# Mutation Plans

Mutation plans turn observed pattern candidates into proposed stress tests.

They do not prove a pattern. They try to make the pattern fail.

## Why Falsification Matters

Alien Puzzle Garden is built around cautious observation. A pattern candidate becomes more interesting when it survives variation, not when a critic describes it confidently.

Useful mutation plans ask questions like:

- Does the pattern survive if the suspected rule is removed?
- Does it survive if the rule output changes?
- Does seeding a suspected gateway symbol make convergence easier?
- Does changing max steps expose an early or late dependency?
- Does the pattern remain visible with more random runs?

## Current Scope

The v0.2.4 command only writes plans:

```bash
npm run mutation-plan -- --latest
```

It generates:

```txt
mutation_plan.json
mutation_plan.md
```

It does not run mutated experiments yet.

## Path to Self-Play Evolution

Later versions can connect the loop:

```txt
mutation_plan.json
mutated_puzzles/
rerun solvers
survival_report.md
next-generation puzzle selection
```

That is the bridge from Strange Pattern Observatory to self-play puzzle evolution.
