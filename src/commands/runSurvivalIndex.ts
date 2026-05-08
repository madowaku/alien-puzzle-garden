import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { writePatternSurvivalIndex } from "../survival/patternSurvivalIndex.ts";

export type RunSurvivalIndexOptions = {
  experimentsDir?: string;
  minRuns?: number;
  help?: boolean;
  quiet?: boolean;
};

export type RunSurvivalIndexResult = {
  generated: boolean;
  message: string;
};

export async function runSurvivalIndex(options: RunSurvivalIndexOptions = {}): Promise<RunSurvivalIndexResult> {
  if (options.help) {
    const help = buildSurvivalIndexHelpText();
    if (!options.quiet) {
      console.log(help);
    }
    return { generated: false, message: help };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  const index = await writePatternSurvivalIndex(experimentsDir, { minRuns: options.minRuns ?? 2 });
  if (!index) {
    const message = "No survival_report.json files found. Run npm run mutation-run first.";
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const message = `Generated Pattern Survival Index from ${index.experimentCount} experiment(s).`;
  if (!options.quiet) {
    console.log(message);
  }
  return { generated: true, message };
}

export function parseSurvivalIndexArgs(args: string[]): RunSurvivalIndexOptions {
  const options: RunSurvivalIndexOptions = { minRuns: 2 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--min-runs" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.minRuns = parsed;
      }
      index += 1;
    } else if (arg === "--experiments-dir" && next) {
      options.experimentsDir = next;
      index += 1;
    }
  }
  return options;
}

export function buildSurvivalIndexHelpText(): string {
  return `Alien Puzzle Garden Pattern Survival Index

Usage:
  npm run survival-index -- [--min-runs 2]

Options:
  --min-runs N
  --help`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runSurvivalIndex(parseSurvivalIndexArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
