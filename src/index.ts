import { runExperiment } from "./experiments/runExperiment.ts";

const options = parseArgs(process.argv.slice(2));
await runExperiment(options);

function parseArgs(args: string[]): { count?: number; randomRuns?: number; seed?: number } {
  const options: { count?: number; randomRuns?: number; seed?: number } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--count" && next) {
      options.count = Number.parseInt(next, 10);
      index += 1;
    } else if ((arg === "--runs" || arg === "--random-runs") && next) {
      options.randomRuns = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--seed" && next) {
      options.seed = Number.parseInt(next, 10);
      index += 1;
    }
  }
  return options;
}
