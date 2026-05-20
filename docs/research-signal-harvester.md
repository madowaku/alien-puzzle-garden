# Research Signal Harvester

Research signals are optional external hints for APG.

They are not part of the deterministic experiment loop, and they should never make claims of proof, novelty, or mathematical significance.

## Safe Default

The sidecar starts local-first:

```bash
python tools/research_harvester.py
npm run research-signals
```

The Python sidecar writes:

```txt
experiments/research_signals.jsonl
```

The APG index command writes:

```txt
experiments/research_signal_index.json
experiments/research_signal_index.md
```

## Awesome Math Vocabulary Seeds

`rossant/awesome-math` is useful as a vocabulary map, not as evidence that an APG trace belongs to a mathematical theory.

Keep it fixture-based and local:

```bash
python tools/research_harvester.py --source awesome-math --input fixtures/awesome-math-sample.md
npm run research-signals
```

The importer scans local Markdown headings and emits only APG-adjacent vocabulary seeds such as Logic, Category Theory, Type Theory, Combinatorics, Graph Theory, Topology, Chaos Theory, and Mathematics for Computer Science.

Each generated signal should be read as:

```txt
possible adjacent vocabulary
translation vocabulary hint
research map anchor
```

It should not be read as:

```txt
proof of connection
novelty claim
paper-ready theory label
```

## Why A Sidecar

Scrapling is a strong future candidate because it supports adaptive selection, multiple fetchers, spider-style crawling, pause/resume, robots.txt compliance, development caching, JSON/JSONL export, and MCP-oriented extraction. APG should borrow that shape without making network collection part of the core CLI.

## Network Rule

Network harvesting is intentionally not implemented yet.

Future collection should be:

- explicit opt-in
- cached
- throttled
- respectful of robots.txt and source terms
- separated from deterministic APG experiments

## Caution

Research signals only suggest possible vocabulary or adjacent concepts. APG patterns still need local mutation pressure, trace evidence, and cautious translation.
