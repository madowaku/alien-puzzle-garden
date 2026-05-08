import type { ApplicableMove, SymbolRewritePuzzle } from "../types.ts";

export function findApplicableMoves(state: string, puzzle: SymbolRewritePuzzle): ApplicableMove[] {
  const moves: ApplicableMove[] = [];

  for (const rule of puzzle.rules) {
    if (rule.from.length === 0) {
      continue;
    }
    for (let index = 0; index <= state.length - rule.from.length; index += 1) {
      if (state.slice(index, index + rule.from.length) !== rule.from) {
        continue;
      }
      moves.push({
        rule,
        matchIndex: index,
        after: `${state.slice(0, index)}${rule.to}${state.slice(index + rule.from.length)}`
      });
    }
  }

  return moves;
}

export function scoreSymbolRewriteState(state: string, puzzle: SymbolRewritePuzzle): number {
  if (state.length === 0) {
    return -8;
  }

  const counts = countSymbols(state, puzzle.alphabet);
  const targetSymbol = "C";
  const diversity = Object.values(counts).filter((count) => count > 0).length;
  const repeatedPairs = countRepeatedPairs(state);
  const dClusterPenalty = countRunsOf(state, "D", 2) * 4;
  const overgrowthPenalty = Math.max(0, state.length - puzzle.initial.length) * 5;
  const lengthBonus = Math.max(0, 16 - state.length) * 2;
  const targetBonus = Math.min(counts[targetSymbol] ?? 0, 4) * 6;
  const diversityBonus = diversity * 3;
  const survivalBonus = state.length >= 2 ? 4 : 0;

  return lengthBonus + targetBonus + diversityBonus + survivalBonus - repeatedPairs * 3 - dClusterPenalty - overgrowthPenalty;
}

function countSymbols(state: string, alphabet: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(alphabet.map((symbol) => [symbol, 0]));
  for (const symbol of state) {
    counts[symbol] = (counts[symbol] ?? 0) + 1;
  }
  return counts;
}

function countRepeatedPairs(state: string): number {
  let count = 0;
  for (let index = 1; index < state.length; index += 1) {
    if (state[index] === state[index - 1]) {
      count += 1;
    }
  }
  return count;
}

function countRunsOf(state: string, symbol: string, minimumLength: number): number {
  let runs = 0;
  let current = 0;
  for (const token of state) {
    if (token === symbol) {
      current += 1;
      continue;
    }
    if (current >= minimumLength) {
      runs += 1;
    }
    current = 0;
  }
  return runs + (current >= minimumLength ? 1 : 0);
}
