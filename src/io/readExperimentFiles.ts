import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExperimentStats, SolverRun, SymbolRewritePuzzle } from "../types.ts";

export type ExperimentArtifacts = {
  id: string;
  dir: string;
  puzzle: SymbolRewritePuzzle;
  solverRuns: SolverRun[];
  stats: ExperimentStats;
  report: string;
};

export async function readExperimentArtifacts(experimentDir: string): Promise<ExperimentArtifacts | null> {
  try {
    const [puzzleText, solverRunsText, statsText] = await Promise.all([
      readFile(join(experimentDir, "puzzle.json"), "utf8"),
      readFile(join(experimentDir, "solver_runs.json"), "utf8"),
      readFile(join(experimentDir, "stats.json"), "utf8")
    ]);
    let report = "";
    try {
      report = await readFile(join(experimentDir, "report.md"), "utf8");
    } catch {
      report = "";
    }
    const puzzle = JSON.parse(puzzleText) as SymbolRewritePuzzle;
    return {
      id: puzzle.id,
      dir: experimentDir,
      puzzle,
      solverRuns: JSON.parse(solverRunsText) as SolverRun[],
      stats: JSON.parse(statsText) as ExperimentStats,
      report
    };
  } catch {
    return null;
  }
}

export async function listExperimentDirs(experimentsDir: string): Promise<string[]> {
  const entries = await readdir(experimentsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^APG-\d{4}$/.test(entry.name))
    .map((entry) => join(experimentsDir, entry.name))
    .sort();
}
