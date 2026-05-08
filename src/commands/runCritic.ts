import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCriticInput } from "../critics/buildCriticPrompt.ts";
import { criticProviders, criticTones, type CriticProvider, type CriticTone } from "../critics/criticSchema.ts";
import { runLlmCritic, writeLlmCriticOutputs } from "../critics/llmCritic.ts";
import { buildMockCriticOutput } from "../critics/mockCritic.ts";
import { runOllamaCritic } from "../critics/ollamaCritic.ts";
import { listExperimentDirs, readExperimentArtifacts } from "../io/readExperimentFiles.ts";

export type RunCriticOptions = {
  experimentsDir?: string;
  apiKey?: string;
  model?: string;
  provider?: CriticProvider;
  tone?: CriticTone;
  help?: boolean;
  latest?: boolean;
  fetchImpl?: typeof fetch;
  quiet?: boolean;
};

export type RunCriticResult = {
  processed: string[];
  skipped: string[];
};

export async function runCritic(options: RunCriticOptions = {}): Promise<RunCriticResult> {
  if (options.help) {
    if (!options.quiet) {
      console.log(buildHelpText());
    }
    return { processed: [], skipped: [] };
  }

  const provider = options.provider ?? parseProvider(process.env.APG_CRITIC_PROVIDER, false) ?? "openai";
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const skipped: string[] = [];
  const processed: string[] = [];

  if (provider === "openai" && !apiKey) {
    const message = "OPENAI_API_KEY is not set. Skipping LLM critic.";
    if (!options.quiet) {
      console.log(message);
    }
    return { processed, skipped: [message] };
  }

  const experimentsDir = options.experimentsDir ?? join(process.cwd(), "experiments");
  const allExperimentDirs = await listExperimentDirs(experimentsDir);
  const experimentDirs = options.latest ? allExperimentDirs.slice(-1) : allExperimentDirs;

  for (const experimentDir of experimentDirs) {
    const artifacts = await readExperimentArtifacts(experimentDir);
    if (!artifacts) {
      const message = `Skipping malformed experiment folder: ${experimentDir}`;
      skipped.push(message);
      if (!options.quiet) {
        console.log(message);
      }
      continue;
    }

    try {
      const input = buildCriticInput(artifacts.puzzle, artifacts.solverRuns, artifacts.stats, artifacts.report);
      const criticResult = provider === "mock"
        ? { output: buildMockCriticOutput(input), rawPayload: undefined }
        : provider === "ollama"
          ? await runOllamaCritic(input, {
            model: options.model,
            tone: options.tone ?? "observatory",
            fetchImpl: options.fetchImpl
          })
          : {
            output: await runLlmCritic(input, {
          apiKey,
          model: options.model,
          tone: options.tone ?? "observatory",
          fetchImpl: options.fetchImpl
            }),
            rawPayload: undefined
          };
      await writeLlmCriticOutputs(artifacts.dir, artifacts.id, criticResult.output, criticResult.rawPayload ?? criticResult.output);
      processed.push(artifacts.id);
      if (!options.quiet) {
        console.log(`Critiqued ${artifacts.id}`);
      }
    } catch (error) {
      const message = `Skipping ${artifacts.id}: ${error instanceof Error ? error.message : String(error)}`;
      skipped.push(message);
      if (!options.quiet) {
        console.log(message);
      }
    }
  }

  if (!options.quiet) {
    console.log("Critic run complete.");
  }

  return { processed, skipped };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runCritic(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export function parseArgs(args: string[]): RunCriticOptions {
  const options: RunCriticOptions = { tone: "observatory" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--all") {
      options.latest = false;
    } else if (arg === "--latest") {
      options.latest = true;
    } else if (arg === "--experiments-dir" && next) {
      options.experimentsDir = next;
      index += 1;
    } else if (arg === "--model" && next) {
      options.model = next;
      index += 1;
    } else if (arg === "--provider" && next) {
      options.provider = parseProvider(next, true);
      index += 1;
    } else if (arg === "--tone" && next) {
      options.tone = parseTone(next);
      index += 1;
    }
  }
  return options;
}

export function buildHelpText(): string {
  return `Alien Puzzle Garden LLM Critic

Usage:
  npm run critic -- [--all] [--latest] [--model MODEL] [--provider openai|mock|ollama] [--tone observatory]

Options:
  --all
  --latest
  --model MODEL
  --provider openai|mock|ollama
  --tone observatory|mathematician|skeptic|poet
  --help`;
}

function parseTone(value: string): CriticTone {
  if ((criticTones as readonly string[]).includes(value)) {
    return value as CriticTone;
  }
  throw new Error(`Unknown critic tone "${value}". Use one of: ${criticTones.join("|")}.`);
}

function parseProvider(value: string | undefined, explicit: boolean): CriticProvider | undefined {
  if (!value) {
    return explicit ? "openai" : undefined;
  }
  if ((criticProviders as readonly string[]).includes(value)) {
    return value as CriticProvider;
  }
  throw new Error(`Unknown critic provider "${value}". Use one of: ${criticProviders.join("|")}.`);
}
