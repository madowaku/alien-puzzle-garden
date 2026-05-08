# API Strategy

Alien Puzzle Garden should stay cheap while it is still a research toy.

## Phase 0: Local Only

Run deterministic local experiments with no API key.

```bash
npm run experiment
```

`npm run critic` should skip safely when no API key is available.

## Phase 1: Mock Critic

Use the mock critic provider for report and mutation-plan development.

```bash
npm run critic -- --provider mock
```

or:

```bash
APG_CRITIC_PROVIDER=mock npm run critic
```

This keeps Markdown report design, JSON shape, and Web Viewer prototypes API-free.

## Phase 2: Local Ollama

Use local models through Ollama on machines that have them installed.

```bash
APG_CRITIC_PROVIDER=ollama APG_CRITIC_MODEL=qwen3.5 npm run critic
```

or:

```bash
npm run critic -- --provider ollama --model gemma4
```

Ollama should stay bound to local development. Do not expose local Ollama to a public network for APG.

## Phase 3: Free-Tier LLM

Add a Gemini provider later and test whether low-cost/free-tier interpretation is useful enough.

## Phase 4: Paid API

Use paid OpenAI, Gemini, Claude, or other providers only after the project has demonstrated value.

## Phase 5: Product Cost Design

After monetization, design user accounts, rate limits, provider routing, API budgets, and billing-aware experiment workflows.
