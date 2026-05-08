import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeEvolutionParentCandidates } from "../evolution/evolutionCandidates.ts";

export type RunEvolutionCandidatesOptions = {
  experimentsDir?: string;
  minScore?: number;
  minResults?: number;
  help?: boolean;
  quiet?: boolean;
};

export type RunEvolutionCandidatesResult = {
  generated: boolean;
  message: string;
};

export async function runEvolutionCandidates(options: RunEvolutionCandidatesOptions = {}): Promise<RunEvolutionCandidatesResult> {
  if (options.help) {
    const help = buildEvolutionCandidatesHelpText();
    if (!options.quiet) {
      console.log(help);
    }
    return { generated: false, message: help };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  const report = await writeEvolutionParentCandidates(experimentsDir, {
    minScore: options.minScore ?? 0.75,
    minResults: options.minResults ?? 3
  });

  if (!report) {
    const message = "No pattern_survival_index.json found. Run npm run survival-index first.";
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const message = `Generated ${report.candidateCount} evolution parent candidate(s).`;
  if (!options.quiet) {
    console.log(message);
  }
  return { generated: true, message };
}

export function parseEvolutionCandidatesArgs(args: string[]): RunEvolutionCandidatesOptions {
  const options: RunEvolutionCandidatesOptions = { minScore: 0.75, minResults: 3 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--min-score" && next) {
      const parsed = Number.parseFloat(next);
      if (Number.isFinite(parsed)) {
        options.minScore = parsed;
      }
      index += 1;
    } else if (arg === "--min-results" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.minResults = parsed;
      }
      index += 1;
    } else if (arg === "--experiments-dir" && next) {
      options.experimentsDir = next;
      index += 1;
    }
  }
  return options;
}

export function buildEvolutionCandidatesHelpText(): string {
  return `Alien Puzzle Garden Evolution Parent Candidates

Usage:
  npm run evolution-candidates -- [--min-score 0.75] [--min-results 3]

Options:
  --min-score SCORE
  --min-results N
  --help`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runEvolutionCandidates(parseEvolutionCandidatesArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
