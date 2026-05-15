#!/usr/bin/env python3
"""APG research signal sidecar.

This script is intentionally conservative. By default it reads a local fixture
or JSON file and writes JSONL signals. Network collection must be explicitly
enabled in a future version; APG should not scrape the web by accident.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any


DEFAULT_SIGNALS = [
    {
        "id": "seed-string-rewriting",
        "title": "String rewriting as an APG seed topic",
        "url": "https://example.invalid/apg/string-rewriting",
        "source": "apg-local-seed",
        "publishedAt": "",
        "topics": ["string rewriting", "symbolic dynamics"],
        "apgConnections": ["symbol rewrite puzzle", "pattern survival"],
        "confidence": "medium",
        "summary": "Local seed signal for rewrite systems, convergence, and symbolic trace behavior.",
    },
    {
        "id": "seed-graph-rewriting",
        "title": "Graph rewriting as a future puzzle substrate",
        "url": "https://example.invalid/apg/graph-rewriting",
        "source": "apg-local-seed",
        "publishedAt": "",
        "topics": ["graph rewriting"],
        "apgConnections": ["graph transform puzzle", "trace atlas"],
        "confidence": "low",
        "summary": "Local seed signal for future graph-state puzzles and structural mutation tests.",
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Harvest APG research signals into JSONL.")
    parser.add_argument("--fixture", help="Read signals from a local JSON or JSONL fixture.")
    parser.add_argument("--output", default="experiments/research_signals.jsonl", help="Output JSONL path.")
    parser.add_argument("--allow-network", action="store_true", help="Reserved for future network harvesting.")
    args = parser.parse_args()

    if args.allow_network:
        raise SystemExit("Network harvesting is not implemented yet. Keep APG local by using --fixture.")

    signals = read_fixture(Path(args.fixture)) if args.fixture else DEFAULT_SIGNALS
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        for signal in signals:
            handle.write(json.dumps(normalize_signal(signal), ensure_ascii=False, sort_keys=True))
            handle.write("\n")
    print(f"Wrote {len(signals)} research signal(s) to {output}")
    return 0


def read_fixture(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    payload = json.loads(text)
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("signals"), list):
        return payload["signals"]
    raise ValueError("Fixture must be a JSON array, an object with signals, or JSONL.")


def normalize_signal(signal: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(signal.get("id", "")),
        "title": str(signal.get("title", "")),
        "url": str(signal.get("url", "")),
        "source": str(signal.get("source", "fixture")),
        "publishedAt": str(signal.get("publishedAt", "")),
        "topics": list_strings(signal.get("topics", [])),
        "apgConnections": list_strings(signal.get("apgConnections", [])),
        "confidence": signal.get("confidence") if signal.get("confidence") in {"low", "medium", "high"} else "low",
        "summary": str(signal.get("summary", "")),
    }


def list_strings(value: Any) -> list[str]:
    if not isinstance(value, Iterable) or isinstance(value, (str, bytes)):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


if __name__ == "__main__":
    raise SystemExit(main())
