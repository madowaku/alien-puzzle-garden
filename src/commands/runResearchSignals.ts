import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildResearchSignalIndex,
  readResearchSignalJsonl,
  renderResearchSignalMarkdown
} from "../research/researchSignals.ts";

export type RunResearchSignalsOptions = {
  inputPath?: string;
  outputDir?: string;
  help?: boolean;
  quiet?: boolean;
};

export type RunResearchSignalsResult = {
  generated: boolean;
  message: string;
};

export async function runResearchSignals(options: RunResearchSignalsOptions = {}): Promise<RunResearchSignalsResult> {
  if (options.help) {
    const message = buildResearchSignalsHelpText();
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const inputPath = options.inputPath ?? join(process.cwd(), "experiments", "research_signals.jsonl");
  const outputDir = options.outputDir ?? join(process.cwd(), "experiments");
  let signals;
  try {
    signals = await readResearchSignalJsonl(inputPath);
  } catch {
    const message = "No research signal JSONL found. Run tools/research_harvester.py first or pass --input.";
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const index = buildResearchSignalIndex(signals);
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "research_signal_index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await writeFile(join(outputDir, "research_signal_index.md"), renderResearchSignalMarkdown(index), "utf8");

  const message = `Generated Research Signal Index for ${index.signalCount} signal(s).`;
  if (!options.quiet) {
    console.log(message);
  }
  return { generated: true, message };
}

export function parseResearchSignalsArgs(args: string[]): RunResearchSignalsOptions {
  const options: RunResearchSignalsOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--input" && next) {
      options.inputPath = next;
      index += 1;
    } else if (arg === "--output-dir" && next) {
      options.outputDir = next;
      index += 1;
    }
  }
  return options;
}

export function buildResearchSignalsHelpText(): string {
  return `Alien Puzzle Garden Research Signals

Usage:
  npm run research-signals -- [--input experiments/research_signals.jsonl] [--output-dir experiments]

Options:
  --input PATH
  --output-dir DIR
  --help`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runResearchSignals(parseResearchSignalsArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
