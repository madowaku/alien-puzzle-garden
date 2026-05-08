import type { SymbolRewritePuzzle, SymbolRewriteRule } from "../types.ts";
import { buildToken, SeededRandom } from "../utils/random.ts";

const DEFAULT_ALPHABET = ["A", "B", "C", "D"] as const;

export function generateSymbolRewritePuzzle(id: string, seed = 1): SymbolRewritePuzzle {
  const rng = new SeededRandom(seed);
  const initial = buildToken(rng, DEFAULT_ALPHABET, 8, 12);
  const ruleTargetCount = rng.integer(5, 8);
  const rules: SymbolRewriteRule[] = [];
  const seen = new Set<string>();
  let emptyOutputCount = 0;

  const addRule = (from: string, to: string): boolean => {
    if (from.length === 0 || from.length > 3 || to.length > 3) {
      return false;
    }
    if (from === to) {
      return false;
    }
    if (to.length === 0 && emptyOutputCount >= 1) {
      return false;
    }
    const key = `${from}->${to}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    if (to.length === 0) {
      emptyOutputCount += 1;
    }
    rules.push({ id: `R${rules.length + 1}`, from, to });
    return true;
  };

  for (const from of pickInitialFragments(initial, rng)) {
    if (rules.length >= 2) {
      break;
    }
    addRule(from, buildNonTrivialOutput(rng));
  }

  let attempts = 0;
  while (rules.length < ruleTargetCount && attempts < 200) {
    attempts += 1;
    const from = buildToken(rng, DEFAULT_ALPHABET, 1, 3);
    const to = rng.next() < 0.14 ? "" : buildToken(rng, DEFAULT_ALPHABET, 1, 3);
    addRule(from, to);
  }

  const fallbackOutputs = ["C", "A", "B", "D", "CA", "DB", "AC", "BD"];
  for (const from of DEFAULT_ALPHABET) {
    for (const to of fallbackOutputs) {
      if (rules.length >= 5) {
        break;
      }
      addRule(from, to);
    }
  }

  if (rules.length < 5) {
    throw new Error(`Unable to generate enough rewrite rules for ${id}.`);
  }

  return {
    id,
    type: "symbol_rewrite",
    alphabet: [...DEFAULT_ALPHABET],
    initial,
    rules,
    maxSteps: rng.integer(10, 14),
    objective: {
      primary: "maximize_score",
      secondary: "minimize_length"
    },
    scoreHints: [
      "more C is good",
      "avoid repeated D clusters",
      "shorter strings are better when they keep structure",
      "diverse surviving symbols may reveal alternate routes"
    ]
  };
}

function pickInitialFragments(initial: string, rng: SeededRandom): string[] {
  const fragments: string[] = [];
  const count = Math.min(3, initial.length);
  for (let size = count; size >= 1; size -= 1) {
    const start = rng.integer(0, initial.length - size);
    fragments.push(initial.slice(start, start + size));
  }
  return fragments;
}

function buildNonTrivialOutput(rng: SeededRandom): string {
  const targetHeavyOutputs = ["C", "CA", "BC", "DA", "B", "CD"];
  return rng.choice(targetHeavyOutputs);
}
