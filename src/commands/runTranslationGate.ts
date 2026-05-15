import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AlienTrace } from "../alien/alienTrace.ts";
import { parseGardenProgramMarkdown } from "../garden/gardenProgram.ts";
import { listExperimentDirs } from "../io/readExperimentFiles.ts";
import { buildTranslationGate, renderTranslationNoteMarkdown } from "../translation/translationGate.ts";

export type RunTranslationGateOptions = {
  experimentsDir?: string;
  latest?: boolean;
  all?: boolean;
  experimentId?: string;
  help?: boolean;
  quiet?: boolean;
};

export type RunTranslationGateResult = {
  generated: string[];
  skipped: string[];
};

export async function runTranslationGate(options: RunTranslationGateOptions = {}): Promise<RunTranslationGateResult> {
  if (options.help) {
    if (!options.quiet) {
      console.log(buildTranslationGateHelpText());
    }
    return { generated: [], skipped: [] };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  const gardenProgram = await readGardenProgram(process.cwd());
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
      const trace = JSON.parse(await readFile(join(experimentDir, "alien_trace.json"), "utf8")) as AlienTrace;
      const gate = buildTranslationGate(trace, gardenProgram);
      await mkdir(experimentDir, { recursive: true });
      await writeFile(join(experimentDir, "translation_gate.json"), `${JSON.stringify(gate, null, 2)}\n`, "utf8");
      if (gate.decision === "translate") {
        await writeFile(join(experimentDir, "translation_note.md"), renderTranslationNoteMarkdown(gate), "utf8");
      } else {
        await unlink(join(experimentDir, "translation_note.md")).catch(() => undefined);
      }
      generated.push(gate.experimentId);
      if (!options.quiet) {
        console.log(`Generated translation gate for ${gate.experimentId}: ${gate.decision}`);
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
    console.log("Translation gate run complete.");
  }
  return { generated, skipped };
}

async function readGardenProgram(rootDir: string): Promise<ReturnType<typeof parseGardenProgramMarkdown> | undefined> {
  try {
    return parseGardenProgramMarkdown(await readFile(join(rootDir, "garden_program.md"), "utf8"));
  } catch {
    return undefined;
  }
}

export function parseTranslationGateArgs(args: string[]): RunTranslationGateOptions {
  const options: RunTranslationGateOptions = { latest: true };
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

export function buildTranslationGateHelpText(): string {
  return `Alien Puzzle Garden Translation Gate

Usage:
  npm run translation-gate -- [--latest] [--all] [--experiment APG-0003]

Options:
  --latest
  --all
  --experiment APG-0003
  --help`;
}

async function selectExperimentDirs(experimentsDir: string, options: RunTranslationGateOptions): Promise<string[]> {
  const allDirs = await listExperimentDirs(experimentsDir);
  if (options.experimentId) {
    const found = allDirs.find((dir) => dir.endsWith(options.experimentId ?? ""));
    if (!found) {
      throw new Error(`Experiment ${options.experimentId} was not found.`);
    }
    return [found];
  }
  if (options.all) {
    return allDirs;
  }
  return allDirs.slice(-1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runTranslationGate(parseTranslationGateArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
