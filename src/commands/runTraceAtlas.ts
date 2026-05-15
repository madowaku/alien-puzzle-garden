import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AlienTrace } from "../alien/alienTrace.ts";
import { buildTraceAtlas, renderTraceAtlasMarkdown, type TraceAtlasInput } from "../atlas/traceAtlas.ts";
import { listExperimentDirs } from "../io/readExperimentFiles.ts";
import type { TranslationGate } from "../translation/translationGate.ts";

export type RunTraceAtlasOptions = {
  experimentsDir?: string;
  help?: boolean;
  quiet?: boolean;
};

export type RunTraceAtlasResult = {
  generated: boolean;
  message: string;
};

export async function runTraceAtlas(options: RunTraceAtlasOptions = {}): Promise<RunTraceAtlasResult> {
  if (options.help) {
    const message = buildTraceAtlasHelpText();
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  const inputs = await readTraceAtlasInputs(experimentsDir);
  if (inputs.length === 0) {
    const message = "No alien_trace.json files found. Run npm run experiment first.";
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const atlas = buildTraceAtlas(inputs);
  await writeFile(join(experimentsDir, "trace_atlas.json"), `${JSON.stringify(atlas, null, 2)}\n`, "utf8");
  await writeFile(join(experimentsDir, "trace_atlas.md"), renderTraceAtlasMarkdown(atlas), "utf8");
  const message = `Generated Trace Atlas for ${atlas.experimentCount} experiment(s).`;
  if (!options.quiet) {
    console.log(message);
  }
  return { generated: true, message };
}

export function parseTraceAtlasArgs(args: string[]): RunTraceAtlasOptions {
  const options: RunTraceAtlasOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--experiments-dir" && next) {
      options.experimentsDir = next;
      index += 1;
    }
  }
  return options;
}

export function buildTraceAtlasHelpText(): string {
  return `Alien Puzzle Garden Trace Atlas

Usage:
  npm run trace-atlas -- [--experiments-dir experiments]

Options:
  --experiments-dir DIR
  --help`;
}

async function readTraceAtlasInputs(experimentsDir: string): Promise<TraceAtlasInput[]> {
  let experimentDirs: string[];
  try {
    experimentDirs = await listExperimentDirs(experimentsDir);
  } catch {
    return [];
  }

  const inputs: TraceAtlasInput[] = [];
  for (const experimentDir of experimentDirs) {
    try {
      const trace = JSON.parse(await readFile(join(experimentDir, "alien_trace.json"), "utf8")) as AlienTrace;
      const gate = await readOptionalTranslationGate(experimentDir);
      inputs.push({ trace, gate });
    } catch {
      // Experiments without traces are old-format runs and are ignored.
    }
  }
  return inputs;
}

async function readOptionalTranslationGate(experimentDir: string): Promise<TranslationGate | undefined> {
  try {
    return JSON.parse(await readFile(join(experimentDir, "translation_gate.json"), "utf8")) as TranslationGate;
  } catch {
    return undefined;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runTraceAtlas(parseTraceAtlasArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
