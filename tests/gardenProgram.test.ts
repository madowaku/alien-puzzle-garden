import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { parseGardenProgramMarkdown, renderGardenStatus } from "../src/garden/gardenProgram.ts";
import { parseGardenStatusArgs, runGardenStatus } from "../src/commands/runGardenStatus.ts";

const markdown = `# Alien Puzzle Garden Program

## Current Research Taste

Prefer patterns that:
- survive rule removal
- show compression behavior
- produce naming debt that can be split

Avoid:
- purely score-attached patterns
- single-rule artifacts

## Evolution Policy

- Promote robust candidates.
- Split fragile broad names.
- Prefer mutations that create interpretable survival differences.
`;

test("garden program parser extracts research taste and evolution policy", () => {
  const program = parseGardenProgramMarkdown(markdown);

  assert.equal(program.title, "Alien Puzzle Garden Program");
  assert.deepEqual(program.preferPatterns, [
    "survive rule removal",
    "show compression behavior",
    "produce naming debt that can be split"
  ]);
  assert.deepEqual(program.avoidPatterns, [
    "purely score-attached patterns",
    "single-rule artifacts"
  ]);
  assert.deepEqual(program.evolutionPolicy, [
    "Promote robust candidates.",
    "Split fragile broad names.",
    "Prefer mutations that create interpretable survival differences."
  ]);
});

test("garden status renders a compact local policy summary", () => {
  const status = renderGardenStatus(parseGardenProgramMarkdown(markdown));

  assert.match(status, /Current garden policy/);
  assert.match(status, /Prefer patterns/);
  assert.match(status, /survive rule removal/);
  assert.match(status, /Avoid/);
  assert.match(status, /single-rule artifacts/);
  assert.match(status, /Evolution policy/);
});

test("garden-status command reads garden_program.md", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "apg-garden-program-"));

  try {
    await writeFile(join(rootDir, "garden_program.md"), markdown, "utf8");
    const result = await runGardenStatus({ rootDir, quiet: true });

    assert.equal(result.found, true);
    assert.match(result.message, /Current garden policy/);
    assert.match(result.message, /Split fragile broad names/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("garden-status reports a missing garden program gracefully", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "apg-garden-program-missing-"));

  try {
    const result = await runGardenStatus({ rootDir, quiet: true });

    assert.equal(result.found, false);
    assert.equal(result.message, "No garden_program.md found. Add one to describe the garden's research taste.");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("garden-status CLI parser supports help and program path", () => {
  assert.deepEqual(parseGardenStatusArgs([]), {});
  assert.deepEqual(parseGardenStatusArgs(["--help"]), { help: true });
  assert.deepEqual(parseGardenStatusArgs(["--program", "docs/program.md"]), { programPath: "docs/program.md" });
});
