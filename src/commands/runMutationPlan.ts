import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { listExperimentDirs } from "../io/readExperimentFiles.ts";
import { buildMutationPlan, renderMutationPlanMarkdown } from "../mutations/mutationPlan.ts";

export type RunMutationPlanOptions = {
  experimentsDir?: string;
  latest?: boolean;
  all?: boolean;
  experimentId?: string;
  help?: boolean;
  quiet?: boolean;
};

export type RunMutationPlanResult = {
  generated: string[];
  skipped: string[];
};

export async function runMutationPlan(options: RunMutationPlanOptions = {}): Promise<RunMutationPlanResult> {
  if (options.help) {
    if (!options.quiet) {
      console.log(buildMutationPlanHelpText());
    }
    return { generated: [], skipped: [] };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  const generated: string[] = [];
  const skipped: string[] = [];
  let experimentDirs: string[];

  try {
    experimentDirs = await selectExperimentDirs(experimentsDir, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!options.quiet) {
      console.log(message);
    }
    return { generated, skipped: [message] };
  }

  for (const experimentDir of experimentDirs) {
    try {
      const plan = await buildMutationPlan(experimentDir);
      await mkdir(experimentDir, { recursive: true });
      await writeFile(join(experimentDir, "mutation_plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
      await writeFile(join(experimentDir, "mutation_plan.md"), renderMutationPlanMarkdown(plan), "utf8");
      generated.push(plan.sourceExperimentId);
      if (!options.quiet) {
        console.log(`Generated mutation plan for ${plan.sourceExperimentId}`);
      }
    } catch (error) {
      const message = `Skipping ${experimentDir}: ${error instanceof Error ? error.message : String(error)}`;
      skipped.push(message);
      if (!options.quiet) {
        console.log(message);
      }
    }
  }

  if (!options.quiet) {
    console.log("Mutation plan run complete.");
  }
  return { generated, skipped };
}

export function parseMutationPlanArgs(args: string[]): RunMutationPlanOptions {
  const options: RunMutationPlanOptions = { latest: true };
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

export function buildMutationPlanHelpText(): string {
  return `Alien Puzzle Garden Mutation Plan Generator

Usage:
  npm run mutation-plan -- [--latest] [--all] [--experiment APG-0003]

Options:
  --latest
  --all
  --experiment APG-0003
  --help`;
}

async function selectExperimentDirs(experimentsDir: string, options: RunMutationPlanOptions): Promise<string[]> {
  const allDirs = await listExperimentDirs(experimentsDir);
  if (options.experimentId) {
    const found = allDirs.find((dir) => dir.endsWith(options.experimentId ?? ""));
    if (!found) {
      throwExperimentNotFound(options.experimentId);
    }
    return [found];
  }
  if (options.all) {
    return allDirs;
  }
  return allDirs.slice(-1);
}

function throwExperimentNotFound(experimentId: string): never {
  throw new ExperimentNotFoundError(`Experiment ${experimentId} was not found.`);
}

class ExperimentNotFoundError extends Error {}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runMutationPlan(parseMutationPlanArgs(process.argv.slice(2)));
  } catch (error) {
    if (error instanceof ExperimentNotFoundError) {
      console.error(error.message);
      process.exitCode = 1;
    } else {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
