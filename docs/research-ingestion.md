# Research Ingestion Notes

Alien Puzzle Garden may eventually benefit from a research harvester that watches mathematics, theoretical computer science, AI reasoning, compression, symbolic dynamics, graph rewriting, and cellular automata sources.

Scrapling is a useful candidate for that future layer because it is a Python web scraping framework with adaptive parsing, multiple fetchers, spider-style crawls, and AI/MCP integration. That fits unstable research pages better than brittle one-off selectors.

The integration should be a sidecar, not part of the v0.1 experiment runner.

Recommended shape:

- Keep `npm run experiment` offline and deterministic.
- Add a separate Python command later, for example `python tools/research_harvester.py --topic "symbol rewriting"`.
- Store harvested summaries under a future `research/` directory as JSON or Markdown.
- Feed only structured summaries into the LLM critic or report critic.
- Respect robots.txt, source terms, rate limits, and privacy laws.
- Prefer official APIs or RSS feeds when available; use scraping only when no stable feed exists.

Useful targets for a future prototype:

- arXiv search and category pages
- conference accepted-paper pages
- journal table-of-contents pages
- research-group blogs
- GitHub repositories for puzzle, theorem-proving, compression, and graph-rewrite tools

The first milestone should not try to prove novelty. It should only attach cautious references such as: "This pattern resembles terminology from string rewriting systems and attractor dynamics; see harvested notes for possible connections."
