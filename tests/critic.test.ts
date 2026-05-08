import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { buildCriticInput, buildCriticPrompt } from "../src/critics/buildCriticPrompt.ts";
import { buildMockCriticOutput } from "../src/critics/mockCritic.ts";
import { runOllamaCritic } from "../src/critics/ollamaCritic.ts";
import { renderLlmCriticMarkdown } from "../src/critics/llmCritic.ts";
import { buildHelpText, parseArgs, runCritic } from "../src/commands/runCritic.ts";
import { runExperiment } from "../src/experiments/runExperiment.ts";
import type { LlmCriticOutput } from "../src/critics/criticSchema.ts";
import type { SolverRun, SymbolRewritePuzzle, ExperimentStats } from "../src/types.ts";

const puzzle: SymbolRewritePuzzle = {
  id: "APG-TEST",
  type: "symbol_rewrite",
  alphabet: ["A", "B", "C", "D"],
  initial: "AABCBAD",
  rules: [
    { id: "R1", from: "AA", to: "D" },
    { id: "R2", from: "AB", to: "C" }
  ],
  maxSteps: 4,
  objective: { primary: "maximize_score", secondary: "minimize_length" },
  scoreHints: ["more C is good"]
};

const runs: SolverRun[] = Array.from({ length: 8 }, (_, index) => ({
  solverName: index % 2 === 0 ? "random" : "greedy",
  runId: `run-${index}`,
  steps: [
    {
      step: 1,
      before: puzzle.initial,
      ruleId: index < 4 ? "R1" : "R2",
      ruleFrom: index < 4 ? "AA" : "AB",
      ruleTo: index < 4 ? "D" : "C",
      matchIndex: 0,
      after: index < 4 ? "DBCBAD" : "ACCBAD"
    }
  ],
  finalState: index < 4 ? "DBCBAD" : `ACCBAD${index}`,
  score: index,
  finalLength: index < 4 ? 6 : 7,
  stoppedReason: "no_moves"
}));

const stats: ExperimentStats = {
  puzzleId: puzzle.id,
  seed: 123,
  runCount: runs.length,
  bestScore: 7,
  averageScore: 3.5,
  bestFinalState: "ACCBAD7",
  bestSolverName: "greedy",
  averageFinalLength: 6.5,
  distinctFinalStates: 5,
  mostCommonFinalStates: [{ state: "DBCBAD", count: 4 }],
  ruleUsageCounts: { R1: 4, R2: 4 },
  patternNotes: ["Many runs converged to DBCBAD."],
  patternObservations: [{ note: "Many runs converged to DBCBAD.", confidence: "medium" }]
};

test("critic input compacts runs into top, low, and diverse representatives", () => {
  const input = buildCriticInput(puzzle, runs, stats, "# deterministic report");

  assert.equal(input.topRuns.length, 5);
  assert.equal(input.lowRuns.length, 5);
  assert.ok(input.representativeRuns.length <= 5);
  assert.deepEqual(input.topRuns.map((run) => run.score), [7, 6, 5, 4, 3]);
  assert.deepEqual(input.lowRuns.map((run) => run.score), [0, 1, 2, 3, 4]);
  assert.equal(input.deterministicPatternNotes[0], "Many runs converged to DBCBAD.");
});

test("critic prompt separates evidence from speculation and forbids proof claims", () => {
  const input = buildCriticInput(puzzle, runs, stats, "# deterministic report");
  const prompt = buildCriticPrompt(input);

  assert.match(prompt.system, /Strange Pattern Observatory/);
  assert.match(prompt.system, /Use this ladder/);
  assert.match(prompt.system, /1\. Observed/);
  assert.match(prompt.system, /pattern candidate/i);
  assert.match(prompt.system, /mutation test/i);
  assert.match(prompt.system, /must not claim proof/i);
  assert.match(prompt.system, /must not claim novelty/i);
  assert.match(prompt.system, /separate observed evidence from speculation/i);
  assert.match(prompt.user, /"topRuns"/);
  assert.doesNotMatch(prompt.user, /OPENAI_API_KEY/);
});

test("critic prompt defaults to observatory tone and accepts tone modifiers", () => {
  const input = buildCriticInput(puzzle, runs, stats, "# deterministic report");
  const defaultPrompt = buildCriticPrompt(input);
  const skepticPrompt = buildCriticPrompt(input, { tone: "skeptic" });

  assert.match(defaultPrompt.system, /observer of the Strange Pattern Observatory/);
  assert.match(skepticPrompt.system, /Act as the skeptic/);
});

test("critic markdown renders all interpretation sections with confidence", () => {
  const output: LlmCriticOutput = {
    summary: "A cautious summary.",
    observedPatterns: [
      { title: "Early C Gate", evidence: "High runs create C early.", confidence: "medium" }
    ],
    possibleInvariants: [
      {
        name: "D Cluster Drag",
        description: "D clusters may slow compression.",
        whyItMightMatter: "It could mark a dead route.",
        confidence: "low"
      }
    ],
    failureEcology: [
      { failureMode: "Expansion drift", evidence: "Long states score poorly.", possibleCause: "Growth rules fire too often." }
    ],
    nextExperiments: [
      { title: "Mutate R2", change: "Replace R2 output with B.", expectedObservation: "Check whether early C still appears." }
    ],
    mathFlavor: ["string rewriting", "attractors"],
    humanMetaphor: "A folded alphabet finding one bright hinge.",
    madowakuNameCandidates: ["Early C Gate", "Fold Hinge"],
    cautions: ["This is not proof."]
  };

  const markdown = renderLlmCriticMarkdown("APG-TEST", output);

  assert.match(markdown, /^# LLM Critic Report: APG-TEST/m);
  assert.match(markdown, /## Failure Ecology/);
  assert.match(markdown, /### Pattern Candidate: Early C Gate/);
  assert.match(markdown, /Observed:/);
  assert.match(markdown, /Interpretation:/);
  assert.match(markdown, /Test:/);
  assert.match(markdown, /### Invariant Candidate: D Cluster Drag/);
  assert.match(markdown, /Status: not yet an invariant/);
  assert.match(markdown, /How to falsify:/);
  assert.match(markdown, /Confidence: medium/);
  assert.match(markdown, /This is not proof/);
});

test("critic CLI parser supports help, default tone, and rejects unknown tone", () => {
  assert.deepEqual(parseArgs([]), { tone: "observatory" });
  assert.deepEqual(parseArgs(["--tone", "poet"]), { tone: "poet" });
  assert.deepEqual(parseArgs(["--provider", "mock"]), { tone: "observatory", provider: "mock" });
  assert.deepEqual(parseArgs(["--provider", "ollama", "--model", "qwen3.5"]), { tone: "observatory", provider: "ollama", model: "qwen3.5" });
  assert.deepEqual(parseArgs(["--help"]), { tone: "observatory", help: true });
  assert.throws(() => parseArgs(["--tone", "loud"]), /Unknown critic tone/);
  assert.throws(() => parseArgs(["--provider", "pretend"]), /Unknown critic provider/);
});

test("runCritic skips gracefully when OPENAI_API_KEY is missing", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-critic-test-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 600, outputDir, quiet: true });
    const result = await runCritic({ experimentsDir: outputDir, apiKey: "", quiet: true });
    assert.deepEqual(result, { processed: [], skipped: ["OPENAI_API_KEY is not set. Skipping LLM critic."] });

    const index = await readFile(join(outputDir, "index.md"), "utf8");
    assert.match(index, /APG-0001/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("critic help does not require OPENAI_API_KEY", async () => {
  const result = await runCritic({ help: true, apiKey: "", quiet: true });
  const stdout = buildHelpText();

  assert.deepEqual(result, { processed: [], skipped: [] });
  assert.match(stdout, /Alien Puzzle Garden LLM Critic/);
  assert.match(stdout, /--provider openai\|mock\|ollama/);
  assert.match(stdout, /--tone observatory\|mathematician\|skeptic\|poet/);
  assert.doesNotMatch(stdout, /OPENAI_API_KEY is not set/);
});

test("mock critic returns valid output with development caution", () => {
  const input = buildCriticInput(puzzle, runs, stats, "# deterministic report");
  const output = buildMockCriticOutput(input);

  assert.match(output.summary, /mock critic provider/i);
  assert.ok(output.observedPatterns.length > 0);
  assert.ok(output.possibleInvariants.length > 0);
  assert.ok(output.failureEcology.length > 0);
  assert.ok(output.nextExperiments.length > 0);
  assert.ok(output.cautions.some((caution) => /mock critic provider/i.test(caution)));
});

test("mock provider writes critic files without API key or network", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-mock-critic-test-"));
  let fetchCalled = false;

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 700, outputDir, quiet: true });
    const result = await runCritic({
      experimentsDir: outputDir,
      apiKey: "",
      provider: "mock",
      quiet: true,
      fetchImpl: (() => {
        fetchCalled = true;
        throw new Error("mock provider must not call network");
      }) as typeof fetch
    });

    const report = await readFile(join(outputDir, "APG-0001", "llm_critic_report.md"), "utf8");
    const raw = JSON.parse(await readFile(join(outputDir, "APG-0001", "llm_critic_raw.json"), "utf8"));

    assert.deepEqual(result, { processed: ["APG-0001"], skipped: [] });
    assert.equal(fetchCalled, false);
    assert.match(report, /mock critic provider/i);
    assert.match(report, /### Pattern Candidate:/);
    assert.ok(raw.cautions.some((caution: string) => /mock critic provider/i.test(caution)));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("openai provider still skips gracefully without OPENAI_API_KEY", async () => {
  const result = await runCritic({ provider: "openai", apiKey: "", quiet: true });
  assert.deepEqual(result, { processed: [], skipped: ["OPENAI_API_KEY is not set. Skipping LLM critic."] });
});

test("ollama provider builds /api/chat request without API key", async () => {
  const input = buildCriticInput(puzzle, runs, stats, "# deterministic report");
  let capturedUrl = "";
  let capturedBody: any;

  const result = await runOllamaCritic(input, {
    model: "qwen3.5",
    baseUrl: "http://localhost:11434",
    fetchImpl: (async (url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        message: {
          role: "assistant",
          content: JSON.stringify(buildMockCriticOutput(input))
        },
        done: true
      }), { status: 200 });
    }) as typeof fetch
  });

  assert.equal(capturedUrl, "http://localhost:11434/api/chat");
  assert.equal(capturedBody.model, "qwen3.5");
  assert.equal(capturedBody.stream, false);
  assert.equal(capturedBody.messages[0].role, "system");
  assert.match(capturedBody.messages[0].content, /Return only valid JSON/);
  assert.equal(result.output.summary, buildMockCriticOutput(input).summary);
});

test("ollama malformed JSON falls back gracefully with raw text", async () => {
  const input = buildCriticInput(puzzle, runs, stats, "# deterministic report");
  const result = await runOllamaCritic(input, {
    model: "gemma4",
    fetchImpl: (async () => new Response(JSON.stringify({
      message: {
        role: "assistant",
        content: "I saw something interesting but did not return JSON."
      },
      done: true
    }), { status: 200 })) as typeof fetch
  });

  assert.match(result.output.summary, /Ollama critic returned malformed JSON/);
  assert.ok(result.output.cautions.some((caution) => /Ollama parsing failed/i.test(caution)));
  assert.equal(result.rawPayload.provider, "ollama");
  assert.equal(result.rawPayload.parseFailed, true);
  assert.match(result.rawPayload.rawText, /did not return JSON/);
});

test("ollama provider writes fallback files without OPENAI_API_KEY", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "apg-ollama-critic-test-"));

  try {
    await runExperiment({ count: 1, randomRuns: 2, seed: 800, outputDir, quiet: true });
    const result = await runCritic({
      experimentsDir: outputDir,
      provider: "ollama",
      model: "qwen3.5",
      quiet: true,
      fetchImpl: (async () => new Response(JSON.stringify({
        message: { role: "assistant", content: "not json" },
        done: true
      }), { status: 200 })) as typeof fetch
    });

    const report = await readFile(join(outputDir, "APG-0001", "llm_critic_report.md"), "utf8");
    const raw = JSON.parse(await readFile(join(outputDir, "APG-0001", "llm_critic_raw.json"), "utf8"));

    assert.deepEqual(result, { processed: ["APG-0001"], skipped: [] });
    assert.match(report, /Ollama parsing failed/i);
    assert.equal(raw.parseFailed, true);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
