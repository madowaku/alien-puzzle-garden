import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseGardenProgramMarkdown, renderGardenStatus } from "../garden/gardenProgram.ts";

export type RunGardenStatusOptions = {
  rootDir?: string;
  programPath?: string;
  help?: boolean;
  quiet?: boolean;
};

export type RunGardenStatusResult = {
  found: boolean;
  message: string;
};

export async function runGardenStatus(options: RunGardenStatusOptions = {}): Promise<RunGardenStatusResult> {
  if (options.help) {
    const message = buildGardenStatusHelpText();
    if (!options.quiet) {
      console.log(message);
    }
    return { found: false, message };
  }

  const rootDir = options.rootDir ?? process.cwd();
  const programPath = options.programPath ?? "garden_program.md";
  let markdown: string;
  try {
    markdown = await readFile(join(rootDir, programPath), "utf8");
  } catch {
    const message = "No garden_program.md found. Add one to describe the garden's research taste.";
    if (!options.quiet) {
      console.log(message);
    }
    return { found: false, message };
  }

  const message = renderGardenStatus(parseGardenProgramMarkdown(markdown));
  if (!options.quiet) {
    console.log(message);
  }
  return { found: true, message };
}

export function parseGardenStatusArgs(args: string[]): RunGardenStatusOptions {
  const options: RunGardenStatusOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--program" && next) {
      options.programPath = next;
      index += 1;
    }
  }
  return options;
}

export function buildGardenStatusHelpText(): string {
  return `Alien Puzzle Garden Status

Usage:
  npm run garden-status -- [--program garden_program.md]

Options:
  --program PATH
  --help`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runGardenStatus(parseGardenStatusArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
