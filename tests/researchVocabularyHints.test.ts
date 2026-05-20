import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResearchVocabularyHints,
  renderResearchVocabularyHintsMarkdown,
  type ResearchVocabularyHintsInput
} from "../src/research/researchVocabularyHints.ts";
import { parseResearchVocabularyHintsArgs, runResearchVocabularyHints } from "../src/commands/runResearchVocabularyHints.ts";

test("research vocabulary hints connect trace families to speculative vocabulary only", () => {
  const hints = buildResearchVocabularyHints(input());

  assert.equal(hints.traceFamilyHints.length, 2);
  assert.equal(hints.traceFamilyHints[0]?.dominantRuleId, "R3");
  assert.ok(hints.traceFamilyHints[0]?.possibleVocabularyHints.some((hint) => hint.term === "string rewriting"));
  assert.ok(hints.traceFamilyHints[0]?.possibleVocabularyHints.every((hint) => hint.status === "translation_vocabulary_only"));
  assert.ok(hints.cautions.some((caution) => /not proof/i.test(caution)));
  assert.match(hints.aiCreoleHandoff, /ROLE: VocabularyScout/);
  assert.match(hints.aiCreoleHandoff, /NO: claim equivalence or novelty/);
});

test("research vocabulary hints markdown separates evidence and vocabulary", () => {
  const markdown = renderResearchVocabularyHintsMarkdown(buildResearchVocabularyHints(input()));

  assert.match(markdown, /# Research Vocabulary Hints/);
  assert.match(markdown, /Local trace evidence/);
  assert.match(markdown, /Possible vocabulary hints/);
  assert.match(markdown, /translation vocabulary only/);
  assert.match(markdown, /not matched theory/);
  assert.match(markdown, /ROLE: VocabularyScout/);
});

test("research-vocabulary-hints command writes json and markdown", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apg-vocab-hints-"));

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "trace_atlas.json"), `${JSON.stringify(input().traceAtlas, null, 2)}\n`, "utf8");
    await writeFile(join(dir, "research_signal_index.json"), `${JSON.stringify(input().researchSignalIndex, null, 2)}\n`, "utf8");

    const result = await runResearchVocabularyHints({ experimentsDir: dir, quiet: true });
    const json = JSON.parse(await readFile(join(dir, "research_vocabulary_hints.json"), "utf8"));
    const markdown = await readFile(join(dir, "research_vocabulary_hints.md"), "utf8");

    assert.deepEqual(result, { generated: true, message: "Generated Research Vocabulary Hints for 2 trace family/families." });
    assert.equal(json.traceFamilyHints.length, 2);
    assert.match(markdown, /Research Vocabulary Hints/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("research-vocabulary-hints command reports missing inputs gracefully", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apg-vocab-missing-"));

  try {
    const result = await runResearchVocabularyHints({ experimentsDir: dir, quiet: true });
    assert.equal(result.generated, false);
    assert.match(result.message, /No trace_atlas.json or research_signal_index.json found/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("research-vocabulary-hints CLI parser supports help and experiments dir", () => {
  assert.deepEqual(parseResearchVocabularyHintsArgs([]), {});
  assert.deepEqual(parseResearchVocabularyHintsArgs(["--help"]), { help: true });
  assert.deepEqual(parseResearchVocabularyHintsArgs(["--experiments-dir", "out"]), { experimentsDir: "out" });
});

function input(): ResearchVocabularyHintsInput {
  return {
    traceAtlas: {
      version: "apg-trace-atlas/v0.1",
      generatedAt: "deterministic:2",
      experimentCount: 2,
      translationDecisionCounts: { translate: 1, do_not_translate: 1 },
      reasonCounts: { "basin diversity": 2, "rule pulse concentration": 1 },
      ruleFamilies: [
        { dominantRuleId: "R3", experimentIds: ["APG-0001"], count: 1, averageHumanInterestScore: 0.82 },
        { dominantRuleId: "R5", experimentIds: ["APG-0002"], count: 1, averageHumanInterestScore: 0.51 }
      ],
      translationCandidates: [
        {
          experimentId: "APG-0001",
          humanInterestScore: 0.82,
          decision: "translate",
          dominantRuleId: "R3",
          basinCount: 5,
          reasons: ["basin diversity", "rule pulse concentration"]
        }
      ],
      quietTraces: [
        {
          experimentId: "APG-0002",
          humanInterestScore: 0.51,
          decision: "do_not_translate",
          dominantRuleId: "R5",
          basinCount: 3,
          reasons: ["basin diversity"]
        }
      ],
      cautions: []
    },
    researchSignalIndex: {
      version: "apg-research-signal-index/v0.1",
      generatedAt: "deterministic:3",
      signalCount: 3,
      topicCounts: {},
      apgConnectionCounts: {},
      signals: [
        {
          id: "sig-rewrite",
          title: "Rewrite vocabulary",
          url: "https://example.test/rewrite",
          source: "fixture",
          topics: ["string rewriting", "symbolic dynamics"],
          apgConnections: ["symbol rewrite puzzle", "pattern survival"],
          confidence: "medium",
          summary: "Vocabulary only."
        },
        {
          id: "sig-graph",
          title: "Graph vocabulary",
          url: "https://example.test/graph",
          source: "fixture",
          topics: ["graph rewriting", "graph theory"],
          apgConnections: ["graph transform puzzle", "trace atlas"],
          confidence: "low",
          summary: "Vocabulary only."
        },
        {
          id: "sig-basin",
          title: "Basin vocabulary",
          url: "https://example.test/basin",
          source: "fixture",
          topics: ["attractor basin", "dynamical systems"],
          apgConnections: ["final-state basin diversity"],
          confidence: "medium",
          summary: "Vocabulary only."
        }
      ],
      recommendations: [],
      cautions: []
    }
  };
}
