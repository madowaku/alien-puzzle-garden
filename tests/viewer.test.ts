import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { scanViewerArtifacts } from "../src/viewer/artifactScanner.ts";
import { resolveAllowedViewerPath } from "../src/viewer/pathSafety.ts";
import { createViewerServer } from "../src/viewer/viewerServer.ts";

test("artifact scanner includes global reports, docs, and README", async () => {
  const rootDir = await createViewerFixture();

  try {
    const tree = await scanViewerArtifacts(rootDir);
    const labels = tree.globalArtifacts.map((artifact) => artifact.label);

    assert.ok(labels.includes("README.md"));
    assert.ok(labels.includes("garden_program.md"));
    assert.ok(labels.includes("docs/web-viewer.md"));
    assert.ok(labels.includes("pattern_survival_index.md"));
    assert.ok(labels.includes("evolution_parent_candidates.md"));
    assert.ok(labels.includes("naming_debt_report.md"));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("artifact scanner includes APG experiment and mutation artifacts", async () => {
  const rootDir = await createViewerFixture();

  try {
    const tree = await scanViewerArtifacts(rootDir);
    const experiment = tree.experiments.find((item) => item.experimentId === "APG-0001");
    const mutation = experiment?.mutations.find((item) => item.mutationId === "MUT-001");

    assert.ok(experiment);
    assert.ok(experiment.artifacts.some((artifact) => artifact.path === "experiments/APG-0001/report.md"));
    assert.ok(experiment.artifacts.some((artifact) => artifact.path === "experiments/APG-0001/puzzle.json"));
    assert.ok(experiment.artifacts.some((artifact) => artifact.path === "experiments/APG-0001/alien_trace.json"));
    assert.ok(mutation);
    assert.ok(mutation.artifacts.some((artifact) => artifact.path === "experiments/APG-0001/mutations/MUT-001/report.md"));
    assert.ok(mutation.artifacts.some((artifact) => artifact.path === "experiments/APG-0001/mutations/MUT-001/mutation_result.json"));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("viewer path safety rejects traversal and absolute paths", async () => {
  const rootDir = await createViewerFixture();

  try {
    assert.throws(() => resolveAllowedViewerPath(rootDir, "../package.json"), /not allowed/i);
    assert.throws(() => resolveAllowedViewerPath(rootDir, "C:/Windows/win.ini"), /not allowed/i);
    assert.throws(() => resolveAllowedViewerPath(rootDir, "/tmp/file.txt"), /not allowed/i);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("viewer path safety allows only README, docs, and experiments files", async () => {
  const rootDir = await createViewerFixture();

  try {
    assert.equal(await readFile(resolveAllowedViewerPath(rootDir, "README.md"), "utf8"), "# APG\n");
    assert.equal(await readFile(resolveAllowedViewerPath(rootDir, "garden_program.md"), "utf8"), "# Garden Program\n");
    assert.equal(await readFile(resolveAllowedViewerPath(rootDir, "docs/web-viewer.md"), "utf8"), "# Viewer\n");
    assert.equal(await readFile(resolveAllowedViewerPath(rootDir, "experiments/APG-0001/report.md"), "utf8"), "# Report\n");
    assert.throws(() => resolveAllowedViewerPath(rootDir, "package.json"), /not allowed/i);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("viewer server renders HTML and exposes artifact APIs", async () => {
  const rootDir = await createViewerFixture();
  const server = createViewerServer({ rootDir });

  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const html = await fetchText(`${baseUrl}/`);
    const artifactTree = await fetchJson(`${baseUrl}/api/artifacts`);
    const file = await fetchJson(`${baseUrl}/api/file?path=experiments/APG-0001/puzzle.json`);
    const missing = await fetch(`${baseUrl}/api/file?path=experiments/APG-0001/missing.md`);

    assert.match(html, /Alien Puzzle Garden/);
    assert.ok(artifactTree.experiments.length > 0);
    assert.equal(file.kind, "json");
    assert.match(file.content, /"id": "APG-0001"/);
    assert.equal(missing.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(rootDir, { recursive: true, force: true });
  }
});

async function createViewerFixture(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "apg-viewer-"));
  await mkdir(join(rootDir, "docs"), { recursive: true });
  await mkdir(join(rootDir, "experiments", "APG-0001", "mutations", "MUT-001"), { recursive: true });

  await writeFile(join(rootDir, "README.md"), "# APG\n", "utf8");
  await writeFile(join(rootDir, "garden_program.md"), "# Garden Program\n", "utf8");
  await writeFile(join(rootDir, "docs", "web-viewer.md"), "# Viewer\n", "utf8");
  await writeFile(join(rootDir, "experiments", "pattern_survival_index.md"), "# Pattern Survival Index\n", "utf8");
  await writeFile(join(rootDir, "experiments", "evolution_parent_candidates.md"), "# Evolution Parent Candidates\n", "utf8");
  await writeFile(join(rootDir, "experiments", "naming_debt_report.md"), "# Naming Debt Report\n", "utf8");
  await writeFile(join(rootDir, "experiments", "APG-0001", "report.md"), "# Report\n", "utf8");
  await writeFile(join(rootDir, "experiments", "APG-0001", "puzzle.json"), `${JSON.stringify({ id: "APG-0001" }, null, 2)}\n`, "utf8");
  await writeFile(join(rootDir, "experiments", "APG-0001", "alien_trace.json"), `${JSON.stringify({ experimentId: "APG-0001" }, null, 2)}\n`, "utf8");
  await writeFile(join(rootDir, "experiments", "APG-0001", "stats.json"), `${JSON.stringify({ puzzleId: "APG-0001" }, null, 2)}\n`, "utf8");
  await writeFile(join(rootDir, "experiments", "APG-0001", "mutations", "MUT-001", "report.md"), "# Mutation\n", "utf8");
  await writeFile(join(rootDir, "experiments", "APG-0001", "mutations", "MUT-001", "mutation_result.json"), `${JSON.stringify({ mutationId: "MUT-001" }, null, 2)}\n`, "utf8");
  return rootDir;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.text();
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.json();
}
