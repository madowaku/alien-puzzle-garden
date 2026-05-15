# Alien Puzzle Garden Roadmap

## v0.1 Symbol Rewrite CLI

Generate symbol rewrite puzzles, run random, greedy, and beam-search solvers, compute simple stats, and write JSON plus Markdown reports.

## v0.2 LLM Critic

Send structured puzzle data, top runs, failed runs, and pattern notes to an optional LLM critic that writes cautious richer interpretations.

## v0.2.1 Critic Tone Pack

Give the critic a small set of observation modes. The default `observatory` tone frames output as Strange Pattern Observatory entries: observed traces, cautious interpretation, naming candidates, and testable follow-up experiments.

## v0.2.2 Provider Adapter

Add mock and Ollama providers so critic development can continue without paid API keys. Mock supports API-free layout and mutation-plan work; Ollama supports local LLM critique on machines that have local models installed.

## v0.2.4 Mutation Plan Generator

Turn observed pattern candidates into proposed stress tests and falsification-oriented follow-up experiments.

## v0.2.5 Mutation Runner

Execute mutation plans, rerun solvers on mutated puzzles, and produce survival reports that classify pattern candidates as survived, weakened, broken, or inconclusive.

## v0.2.6 Pattern Survival Index

Aggregate survival reports across experiments and classify named pattern candidates as robust, unstable, fragile, or under-tested under local mutation pressure.

## v0.2.7 Evolution Parent Candidates

Read Pattern Survival Index output and classify named patterns as parent candidates, watchlist items, rename/split candidates, or under-tested candidates for future self-play evolution.

## v0.2.8 Naming Debt Report

Read evolution candidate decisions and identify fragile, under-tested, or overly broad pattern names that should be renamed, split, or tested further.

## v0.2.9 Minimal Web Viewer

Add a local read-only observatory interface for browsing experiments, reports, mutation results, survival index, evolution candidates, and naming debt.

## v0.2.9.2 DeepSeek-R1 Local Critic Compatibility

Improve the Ollama critic path for local reasoning models by asking for JSON-only output and stripping `<think>...</think>` reasoning blocks before schema parsing.

## v0.2.10 Garden Program

Add `garden_program.md` as the human-written research taste for APG, plus `npm run garden-status` and viewer access so future evolution can read the garden's policy without changing code.

## v0.2.11 AI-Native Trace

Write `alien_trace.json` for each experiment as a deterministic machine-facing observation layer. Human translation remains optional and separate: APG should first let AI systems explore in AI-native traces, tapes, symbols, or non-language forms.

## v0.2.12 Translation Gate

Read `alien_trace.json` and decide whether the trace is worth a short human-facing note. Most traces can remain AI-native; only traces with enough local contrast, basin diversity, or rule concentration should produce `translation_note.md`.

## v0.2.13 Research Signal Harvester

Add an optional Python sidecar for collecting recent research signals from sources such as arXiv, journal pages, conference programs, and research blogs. Scrapling is a strong candidate for this layer because it supports adaptive selectors, multiple fetchers, crawls, and AI/MCP-oriented extraction, but it should remain optional so the v0.1 CLI stays local and deterministic.

## v0.3 Graph Transform Puzzle

Add graph-state puzzles with edge transforms, degree constraints, and convergence analysis.

## v0.4 Web Viewer

Add a local viewer for experiments, puzzle JSON, solver runs, reports, and manual madowaku naming.

## v0.5 Self-play Puzzle Evolution

Use interesting experiments as parents, mutate rule sets, run new solver batches, and select the next generation by observed patterns.

## v1.0 Alien Puzzle Garden

Combine puzzle maker, solver, critic, mathematician, translator, and naming workflows into a full AI-only puzzle garden.
