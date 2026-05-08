import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExperimentStats, ExperimentSummary, SolverRun, SymbolRewritePuzzle } from "../types.ts";

export async function writeExperimentFiles(
  rootDir: string,
  puzzle: SymbolRewritePuzzle,
  runs: SolverRun[],
  stats: ExperimentStats,
  report: string
): Promise<void> {
  const experimentDir = join(rootDir, puzzle.id);
  await mkdir(experimentDir, { recursive: true });
  await writeFile(join(experimentDir, "puzzle.json"), `${JSON.stringify(puzzle, null, 2)}\n`, "utf8");
  await writeFile(join(experimentDir, "solver_runs.json"), `${JSON.stringify(runs, null, 2)}\n`, "utf8");
  await writeFile(join(experimentDir, "stats.json"), `${JSON.stringify(stats, null, 2)}\n`, "utf8");
  await writeFile(join(experimentDir, "report.md"), report, "utf8");
}

export async function writeExperimentIndex(rootDir: string, summaries: ExperimentSummary[]): Promise<void> {
  await mkdir(rootDir, { recursive: true });
  const rows = summaries
    .map((summary) => `| ${summary.id} | ${summary.seed} | ${summary.bestScore} | ${summary.bestSolverName} | ${summary.distinctFinalStates} | ${summary.madowakuName} |`)
    .join("\n");
  const markdown = `# Alien Puzzle Garden Experiments

| Puzzle ID | Seed | Best Score | Best Solver | Distinct Final States | madowaku Name |
| --- | ---: | ---: | --- | ---: | --- |
${rows}
`;
  await writeFile(join(rootDir, "index.md"), markdown, "utf8");
}
