import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeNamingDebtReport } from "../naming/namingDebt.ts";

export type RunNamingDebtOptions = {
  experimentsDir?: string;
  includeWatchlist?: boolean;
  help?: boolean;
  quiet?: boolean;
};

export type RunNamingDebtResult = {
  generated: boolean;
  message: string;
};

export async function runNamingDebt(options: RunNamingDebtOptions = {}): Promise<RunNamingDebtResult> {
  if (options.help) {
    const help = buildNamingDebtHelpText();
    if (!options.quiet) {
      console.log(help);
    }
    return { generated: false, message: help };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  const result = await writeNamingDebtReport(experimentsDir, { includeWatchlist: options.includeWatchlist ?? false });

  if (result === "missing-candidates") {
    const message = "No evolution_parent_candidates.json found. Run npm run evolution-candidates first.";
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  if (result === "missing-index") {
    const message = "No pattern_survival_index.json found. Run npm run survival-index first.";
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const message = `Generated naming debt report with ${result.entryCount} entr${result.entryCount === 1 ? "y" : "ies"}.`;
  if (!options.quiet) {
    console.log(message);
  }
  return { generated: true, message };
}

export function parseNamingDebtArgs(args: string[]): RunNamingDebtOptions {
  const options: RunNamingDebtOptions = { includeWatchlist: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--include-watchlist") {
      options.includeWatchlist = true;
    } else if (arg === "--experiments-dir" && next) {
      options.experimentsDir = next;
      index += 1;
    }
  }
  return options;
}

export function buildNamingDebtHelpText(): string {
  return `Alien Puzzle Garden Naming Debt Report

Usage:
  npm run naming-debt -- [--include-watchlist]

Options:
  --include-watchlist
  --help`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runNamingDebt(parseNamingDebtArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
