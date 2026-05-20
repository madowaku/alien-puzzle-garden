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
    parser.add_argument("--source", choices=["local-seed", "awesome-math"], default="local-seed", help="Signal source parser.")
    parser.add_argument("--input", help="Input file for the selected source parser.")
    parser.add_argument("--output", default="experiments/research_signals.jsonl", help="Output JSONL path.")
    parser.add_argument("--allow-network", action="store_true", help="Reserved for future network harvesting.")
    args = parser.parse_args()

    if args.allow_network:
        raise SystemExit("Network harvesting is not implemented yet. Keep APG local by using --fixture.")

    signals = load_signals(args)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        for signal in signals:
            handle.write(json.dumps(normalize_signal(signal), ensure_ascii=False, sort_keys=True))
            handle.write("\n")
    print(f"Wrote {len(signals)} research signal(s) to {output}")
    return 0


def load_signals(args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.fixture:
        return read_fixture(Path(args.fixture))
    if args.source == "awesome-math":
        if not args.input:
            raise SystemExit("--source awesome-math requires --input with a local README fixture.")
        return parse_awesome_math(Path(args.input))
    return DEFAULT_SIGNALS


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


AWESOME_MATH_TOPIC_MAP = {
    "Logic": {
        "tags": ["logic", "foundations", "proof systems"],
        "apgConnections": ["translation gate", "AI Creole handoff", "pattern naming"],
        "confidence": "medium",
    },
    "Category Theory": {
        "tags": ["category theory", "structure preserving maps", "composition"],
        "apgConnections": ["graph transform puzzle", "fluffy laboratory bridge"],
        "confidence": "low",
    },
    "Type Theory": {
        "tags": ["type theory", "formal systems", "proof assistants"],
        "apgConnections": ["AI-native trace", "AI Creole handoff"],
        "confidence": "low",
    },
    "Homotopy Type Theory": {
        "tags": ["homotopy type theory", "type theory", "topology"],
        "apgConnections": ["AI-native trace", "translation vocabulary"],
        "confidence": "low",
    },
    "Combinatorics": {
        "tags": ["combinatorics", "discrete mathematics", "counting structures"],
        "apgConnections": ["symbol rewrite puzzle", "pattern survival"],
        "confidence": "medium",
    },
    "Graph Theory": {
        "tags": ["graph theory", "combinatorics", "discrete mathematics"],
        "apgConnections": ["graph transform puzzle", "trace atlas"],
        "confidence": "medium",
    },
    "Topology": {
        "tags": ["topology", "shape", "continuity"],
        "apgConnections": ["basin structure", "trace atlas"],
        "confidence": "low",
    },
    "Algebraic Topology": {
        "tags": ["algebraic topology", "topology", "invariants"],
        "apgConnections": ["possible invariants", "pattern survival"],
        "confidence": "low",
    },
    "Chaos Theory": {
        "tags": ["chaos theory", "dynamical systems", "sensitive dependence"],
        "apgConnections": ["rule pulse concentration", "final-state basin diversity"],
        "confidence": "medium",
    },
    "Mathematics for Computer Science": {
        "tags": ["mathematics for computer science", "computation", "discrete structures"],
        "apgConnections": ["symbol rewrite puzzle", "solver traces"],
        "confidence": "medium",
    },
}


def parse_awesome_math(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    headings = extract_markdown_headings(text)
    signals: list[dict[str, Any]] = []
    for topic, config in AWESOME_MATH_TOPIC_MAP.items():
        if topic not in headings:
            continue
        tags = config["tags"]
        apg_connections = config["apgConnections"]
        signals.append(
            {
                "id": f"awesome-math-{slugify(topic)}",
                "title": f"Awesome Math vocabulary map: {topic}",
                "url": f"https://github.com/rossant/awesome-math#{slugify(topic)}",
                "source": "awesome-math",
                "publishedAt": "",
                "topics": [topic, *tags],
                "apgConnections": apg_connections,
                "confidence": config["confidence"],
                "summary": (
                    f"Vocabulary seed from the awesome-math {topic} section. "
                    "Use as adjacent language for APG translation, Trace Atlas notes, or laboratory handoff only. "
                    "Vocabulary hint only; not evidence of connection to APG traces."
                ),
            }
        )
    return signals


def extract_markdown_headings(markdown: str) -> set[str]:
    headings: set[str] = set()
    for line in markdown.splitlines():
        stripped = line.strip()
        if not stripped.startswith("#"):
            continue
        title = stripped.lstrip("#").strip()
        if title:
            headings.add(title)
    return headings


def slugify(value: str) -> str:
    return "-".join("".join(char.lower() if char.isalnum() else "-" for char in value).split("-")).strip("-")


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
