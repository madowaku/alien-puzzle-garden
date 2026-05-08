import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { scanViewerArtifacts } from "./artifactScanner.ts";
import { resolveAllowedViewerPath } from "./pathSafety.ts";
import { renderViewerHtml } from "./renderViewerHtml.ts";

export type ViewerServerOptions = {
  rootDir?: string;
};

export function createViewerServer(options: ViewerServerOptions = {}): Server {
  const rootDir = options.rootDir ?? process.cwd();
  return createServer(async (request, response) => {
    try {
      await routeRequest(rootDir, request, response);
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

async function routeRequest(rootDir: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (url.pathname === "/") {
    sendText(response, 200, renderViewerHtml(), "text/html; charset=utf-8");
    return;
  }

  if (url.pathname === "/viewer.css" || url.pathname === "/viewer.js") {
    await sendStaticViewerFile(rootDir, response, url.pathname.slice(1));
    return;
  }

  if (url.pathname === "/api/artifacts") {
    sendJson(response, 200, await scanViewerArtifacts(rootDir));
    return;
  }

  if (url.pathname === "/api/file") {
    await sendViewerFile(rootDir, response, url.searchParams.get("path") ?? "");
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

async function sendStaticViewerFile(rootDir: string, response: ServerResponse, fileName: string): Promise<void> {
  try {
    const absolutePath = join(rootDir, "public", "viewer", fileName);
    const content = await readFile(absolutePath, "utf8");
    sendText(response, 200, content, fileName.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8");
  } catch {
    sendJson(response, 404, { error: "Static viewer file not found." });
  }
}

async function sendViewerFile(rootDir: string, response: ServerResponse, requestedPath: string): Promise<void> {
  let absolutePath: string;
  try {
    absolutePath = resolveAllowedViewerPath(rootDir, requestedPath);
  } catch {
    sendJson(response, 403, { error: "File path is not allowed." });
    return;
  }

  try {
    const content = await readFile(absolutePath, "utf8");
    sendJson(response, 200, {
      path: requestedPath,
      kind: kindFor(requestedPath),
      content
    });
  } catch {
    sendJson(response, 404, { error: "File not found." });
  }
}

function kindFor(path: string): "markdown" | "json" | "text" {
  const extension = extname(path);
  if (extension === ".md") {
    return "markdown";
  }
  if (extension === ".json") {
    return "json";
  }
  return "text";
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  sendText(response, statusCode, `${JSON.stringify(value, null, 2)}\n`, "application/json; charset=utf-8");
}

function sendText(response: ServerResponse, statusCode: number, content: string, contentType: string): void {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  response.end(content);
}
