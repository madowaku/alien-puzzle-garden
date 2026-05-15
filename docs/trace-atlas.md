# Trace Atlas

The Trace Atlas is a cross-experiment map of AI-native traces.

It does not translate every trace. It groups traces so APG can see which alien plates are recurring, quiet, dense, or worth a human note.

## Command

```bash
npm run trace-atlas
```

## Inputs

The atlas scans experiment folders for:

```txt
alien_trace.json
translation_gate.json
```

If `translation_gate.json` is missing, the atlas uses the deterministic translation gate fallback.

## Outputs

```txt
experiments/trace_atlas.json
experiments/trace_atlas.md
```

## What It Measures

- translation decision counts
- recurring translation reasons
- dominant rule-pulse families
- translation candidates
- quiet AI-native traces

## Viewer Cards

The local viewer summarizes `trace_atlas.json` in the right pane:

- experiment count
- translation decision counts
- top reasons
- top rule families
- translation candidates
- quiet traces

## Observatory Note

This atlas does not prove a pattern. It is a map of local trace signals.

The point is not to force human readability. The point is to help future APG agents decide which traces to cluster, mutate, translate, or ignore.
