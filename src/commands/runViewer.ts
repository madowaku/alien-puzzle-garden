import { fileURLToPath } from "node:url";
import { createViewerServer } from "../viewer/viewerServer.ts";

export type RunViewerOptions = {
  port?: number;
  host?: string;
  rootDir?: string;
  help?: boolean;
};

export function parseViewerArgs(args: string[]): RunViewerOptions {
  const options: RunViewerOptions = { port: 4177, host: "127.0.0.1" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--port" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.port = parsed;
      }
      index += 1;
    } else if (arg === "--host" && next) {
      options.host = next;
      index += 1;
    }
  }
  return options;
}

export function viewerHelpText(): string {
  return `Alien Puzzle Garden Local Viewer

Usage:
  npm run viewer -- [--port 4177]

Options:
  --port PORT
  --help`;
}

export async function runViewer(options: RunViewerOptions = {}): Promise<void> {
  if (options.help) {
    console.log(viewerHelpText());
    return;
  }

  const port = options.port ?? 4177;
  const host = options.host ?? "127.0.0.1";
  const server = createViewerServer({ rootDir: options.rootDir ?? process.cwd() });
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  console.log(`Alien Puzzle Garden viewer running at http://localhost:${port}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runViewer(parseViewerArgs(process.argv.slice(2)));
}
