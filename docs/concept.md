# Alien Puzzle Garden Concept

Alien Puzzle Garden is an experiment runner for puzzles that are not designed for direct human play.

The first version creates strange rule spaces, lets mechanical solvers explore them, records the traces, and writes reports that help a human observer notice unusual convergence, compression, failure, or naming-worthy patterns.

Human readability is optional because the player is not the point. The early purpose is to create a small local laboratory where solver behavior can leave artifacts worth reading.

Version 0.1 focuses only on Symbol Rewrite puzzles. Later versions can add an LLM critic, graph transform puzzles, a web viewer, self-play mutation, and a fuller set of AI roles: maker, solver, critic, mathematician, translator, and namer.

Research ingestion should stay outside the v0.1 runtime. A later optional sidecar can collect recent mathematics, computer science, and puzzle-theory references, then feed summaries into the critic without making the local experiment runner depend on the web.
