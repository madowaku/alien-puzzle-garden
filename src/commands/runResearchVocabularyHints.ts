import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TraceAtlas } from "../atlas/traceAtlas.ts";
import type { ResearchSignalIndex } from "../research/researchSignals.ts";
import {
  buildResearchVocabularyHints,
  renderResearchVocabularyHintsMarkdown
} from "../research/researchVocabularyHints.ts";

export type RunResearchVocabularyHintsOptions = {
  experimentsDir?: string;
  help?: boolean;
  quiet?: boolean;
};

export type RunResearchVocabularyHintsResult = {
  generated: boolean;
  message: string;
};

export async function runResearchVocabularyHints(options: RunResearchVocabularyHintsOptions = {}): Promise<RunResearchVocabularyHintsResult> {
  if (options.help) {
    const message = buildResearchVocabularyHintsHelpText();
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  let traceAtlas: TraceAtlas;
  let researchSignalIndex: ResearchSignalIndex;
  try {
    traceAtlas = JSON.parse(await readFile(join(experimentsDir, "trace_atlas.json"), "utf8")) as TraceAtlas;
    researchSignalIndex = JSON.parse(await readFile(join(experimentsDir, "research_signal_index.json"), "utf8")) as ResearchSignalIndex;
  } catch {
    const message = "No trace_atlas.json or research_signal_index.json found. Run npm run trace-atlas and npm run research-signals first.";
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const hints = buildResearchVocabularyHints({ traceAtlas, researchSignalIndex });
  await writeFile(join(experimentsDir, "research_vocabulary_hints.json"), `${JSON.stringify(hints, null, 2)}\n`, "utf8");
  await writeFile(join(experimentsDir, "research_vocabulary_hints.md"), renderResearchVocabularyHintsMarkdown(hints), "utf8");

  const message = `Generated Research Vocabulary Hints for ${hints.traceFamilyHints.length} trace family/families.`;
  if (!options.quiet) {
    console.log(message);
  }
  return { generated: true, message };
}

export function parseResearchVocabularyHintsArgs(args: string[]): RunResearchVocabularyHintsOptions {
  const options: RunResearchVocabularyHintsOptions = {};
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

export function buildResearchVocabularyHintsHelpText(): string {
  return `Alien Puzzle Garden Research Vocabulary Hints

Usage:
  npm run research-vocabulary-hints -- [--experiments-dir experiments]

Options:
  --experiments-dir DIR
  --help`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runResearchVocabularyHints(parseResearchVocabularyHintsArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
