import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { listExperimentDirs } from "../io/readExperimentFiles.ts";
import { runMutationPlanForExperiment } from "../mutations/mutationRunner.ts";

export type RunMutationRunOptions = {
  experimentsDir?: string;
  latest?: boolean;
  all?: boolean;
  experimentId?: string;
  help?: boolean;
  quiet?: boolean;
};

export type RunMutationRunResult = {
  generated: string[];
  skipped: string[];
};

export async function runMutationRun(options: RunMutationRunOptions = {}): Promise<RunMutationRunResult> {
  if (options.help) {
    if (!options.quiet) {
      console.log(buildMutationRunHelpText());
    }
    return { generated: [], skipped: [] };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  const generated: string[] = [];
  const skipped: string[] = [];
  const experimentDirs = await selectExperimentDirs(experimentsDir, options);

  for (const experimentDir of experimentDirs) {
    const id = experimentDir.split(/[\\/]/).at(-1) ?? experimentDir;
    try {
      await runMutationPlanForExperiment(experimentDir);
      generated.push(id);
      if (!options.quiet) {
        console.log(`Ran mutation plan for ${id}`);
      }
    } catch (error) {
      const message = normalizeError(id, error);
      skipped.push(message);
      if (!options.quiet) {
        console.log(message);
      }
    }
  }

  if (!options.quiet) {
    console.log("Mutation run complete.");
  }
  return { generated, skipped };
}

export function parseMutationRunArgs(args: string[]): RunMutationRunOptions {
  const options: RunMutationRunOptions = { latest: true };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--all") {
      options.latest = false;
      options.all = true;
    } else if (arg === "--latest") {
      options.latest = true;
      options.all = false;
    } else if (arg === "--experiment" && next) {
      options.latest = false;
      options.experimentId = next;
      index += 1;
    } else if (arg === "--experiments-dir" && next) {
      options.experimentsDir = next;
      index += 1;
    }
  }
  return options;
}

export function buildMutationRunHelpText(): string {
  return `Alien Puzzle Garden Mutation Runner

Usage:
  npm run mutation-run -- [--latest] [--all] [--experiment APG-0003]

Options:
  --latest
  --all
  --experiment APG-0003
  --help`;
}

async function selectExperimentDirs(experimentsDir: string, options: RunMutationRunOptions): Promise<string[]> {
  const allDirs = await listExperimentDirs(experimentsDir);
  if (options.experimentId) {
    const found = allDirs.find((dir) => dir.endsWith(options.experimentId ?? ""));
    return found ? [found] : [join(experimentsDir, options.experimentId)];
  }
  if (options.all) {
    return allDirs;
  }
  return allDirs.slice(-1);
}

function normalizeError(id: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("No mutation_plan.json found")) {
    return `No mutation_plan.json found for ${id}. Run npm run mutation-plan first.`;
  }
  if (message.includes("ENOENT")) {
    return `Experiment ${id} was not found.`;
  }
  return `Skipping ${id}: ${message}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runMutationRun(parseMutationRunArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
