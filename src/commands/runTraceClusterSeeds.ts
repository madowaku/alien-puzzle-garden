import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TraceAtlas } from "../atlas/traceAtlas.ts";
import { buildTraceClusterSeeds, renderTraceClusterSeedsMarkdown } from "../atlas/traceClusterSeeds.ts";
import type { ResearchVocabularyHints } from "../research/researchVocabularyHints.ts";

export type RunTraceClusterSeedsOptions = {
  experimentsDir?: string;
  help?: boolean;
  quiet?: boolean;
};

export type RunTraceClusterSeedsResult = {
  generated: boolean;
  message: string;
};

export async function runTraceClusterSeeds(options: RunTraceClusterSeedsOptions = {}): Promise<RunTraceClusterSeedsResult> {
  if (options.help) {
    const message = buildTraceClusterSeedsHelpText();
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  let traceAtlas: TraceAtlas;
  let researchVocabularyHints: ResearchVocabularyHints;
  try {
    traceAtlas = JSON.parse(await readFile(join(experimentsDir, "trace_atlas.json"), "utf8")) as TraceAtlas;
    researchVocabularyHints = JSON.parse(await readFile(join(experimentsDir, "research_vocabulary_hints.json"), "utf8")) as ResearchVocabularyHints;
  } catch {
    const message = "No trace_atlas.json or research_vocabulary_hints.json found. Run npm run trace-atlas and npm run research-vocabulary-hints first.";
    if (!options.quiet) {
      console.log(message);
    }
    return { generated: false, message };
  }

  const clusterSeeds = buildTraceClusterSeeds({ traceAtlas, researchVocabularyHints });
  await writeFile(join(experimentsDir, "trace_cluster_seeds.json"), `${JSON.stringify(clusterSeeds, null, 2)}\n`, "utf8");
  await writeFile(join(experimentsDir, "trace_cluster_seeds.md"), renderTraceClusterSeedsMarkdown(clusterSeeds), "utf8");

  const message = `Generated Trace Cluster Seeds for ${clusterSeeds.seedCount} seed(s).`;
  if (!options.quiet) {
    console.log(message);
  }
  return { generated: true, message };
}

export function parseTraceClusterSeedsArgs(args: string[]): RunTraceClusterSeedsOptions {
  const options: RunTraceClusterSeedsOptions = {};
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

export function buildTraceClusterSeedsHelpText(): string {
  return `Alien Puzzle Garden Trace Cluster Seeds

Usage:
  npm run trace-cluster-seeds -- [--experiments-dir experiments]

Options:
  --experiments-dir DIR
  --help`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runTraceClusterSeeds(parseTraceClusterSeedsArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
