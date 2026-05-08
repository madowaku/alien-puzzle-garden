# Alien Puzzle Garden

AI-only puzzle experiment runner.

Alien Puzzle Garden generates strange symbolic puzzle spaces, lets solvers explore them, observes pattern candidates, mutates them, and tracks whether named patterns survive local mutation pressure.

It is not a human-playable puzzle game yet. It is a local research toy for strange pattern observation.

## Current Flow

```bash
npm run experiment
npm run critic -- --provider mock
npm run mutation-plan
npm run mutation-run
npm run survival-index
npm run evolution-candidates
npm run naming-debt
```

## Local Web Viewer

```bash
npm run viewer
```

Then open:

```txt
http://localhost:4177
```

The viewer is local, read-only, and does not call any LLM or external API.

## API Strategy

- `mock`: no API key
- `ollama`: local LLM
- `openai`: optional paid provider

## Status

Private experimental project.
