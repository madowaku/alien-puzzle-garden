# Minimal Web Viewer

The APG viewer is a local, read-only observatory interface.

```bash
npm run viewer
```

Then open:

```txt
http://localhost:4177
```

The viewer reads local artifacts from `experiments/`, `docs/`, and `README.md`. It does not call an LLM, database, cloud API, or external network service.

## What It Shows

- global survival, evolution, and naming-debt reports
- experiment reports and JSON artifacts
- mutation reports and mutation JSON artifacts
- documentation and README files

## Current Limits

This first viewer is intentionally read-only. It has no editing, naming workflow, or evolution controls yet.
