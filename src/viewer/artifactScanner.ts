import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type ViewerArtifact = {
  id: string;
  label: string;
  path: string;
  kind: "markdown" | "json" | "text";
  group: "global" | "experiment" | "mutation";
  experimentId?: string;
  mutationId?: string;
};

export type ViewerArtifactTree = {
  generatedAt: string;
  globalArtifacts: ViewerArtifact[];
  experiments: Array<{
    experimentId: string;
    artifacts: ViewerArtifact[];
    mutations: Array<{
      mutationId: string;
      artifacts: ViewerArtifact[];
    }>;
  }>;
};

const GLOBAL_EXPERIMENT_FILES = [
  "experiments/trace_atlas.md",
  "experiments/trace_atlas.json",
  "experiments/research_signal_index.md",
  "experiments/research_signal_index.json",
  "experiments/research_vocabulary_hints.md",
  "experiments/research_vocabulary_hints.json",
  "experiments/pattern_survival_index.md",
  "experiments/evolution_parent_candidates.md",
  "experiments/naming_debt_report.md"
];

const EXPERIMENT_FILES = [
  "report.md",
  "llm_critic_report.md",
  "mutation_plan.md",
  "survival_report.md",
  "puzzle.json",
  "alien_trace.json",
  "translation_gate.json",
  "translation_note.md",
  "stats.json",
  "mutation_plan.json",
  "survival_report.json"
];

const MUTATION_FILES = [
  "report.md",
  "mutation_result.json",
  "mutated_puzzle.json",
  "stats.json"
];

export async function scanViewerArtifacts(rootDir: string): Promise<ViewerArtifactTree> {
  const globalArtifacts = await scanGlobalArtifacts(rootDir);
  const experiments = await scanExperiments(rootDir);
  return {
    generatedAt: `deterministic:${globalArtifacts.length}:${experiments.length}`,
    globalArtifacts,
    experiments
  };
}

async function scanGlobalArtifacts(rootDir: string): Promise<ViewerArtifact[]> {
  const artifacts: ViewerArtifact[] = [];
  for (const relativePath of ["README.md", "AI_CREOLE.md", "garden_program.md", ...await listDocs(rootDir), ...GLOBAL_EXPERIMENT_FILES]) {
    if (await fileExists(rootDir, relativePath)) {
      artifacts.push(toArtifact(relativePath, "global"));
    }
  }
  return artifacts;
}

async function scanExperiments(rootDir: string): Promise<ViewerArtifactTree["experiments"]> {
  const experimentsDir = join(rootDir, "experiments");
  let entries;
  try {
    entries = await readdir(experimentsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const experimentIds = entries
    .filter((entry) => entry.isDirectory() && /^APG-\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const experiments: ViewerArtifactTree["experiments"] = [];
  for (const experimentId of experimentIds) {
    const artifacts: ViewerArtifact[] = [];
    for (const fileName of EXPERIMENT_FILES) {
      const relativePath = `experiments/${experimentId}/${fileName}`;
      if (await fileExists(rootDir, relativePath)) {
        artifacts.push(toArtifact(relativePath, "experiment", experimentId));
      }
    }
    experiments.push({
      experimentId,
      artifacts,
      mutations: await scanMutations(rootDir, experimentId)
    });
  }
  return experiments;
}

async function scanMutations(rootDir: string, experimentId: string): Promise<ViewerArtifactTree["experiments"][number]["mutations"]> {
  const mutationsDir = join(rootDir, "experiments", experimentId, "mutations");
  let entries;
  try {
    entries = await readdir(mutationsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const mutationIds = entries
    .filter((entry) => entry.isDirectory() && /^MUT-[\w-]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const mutations: ViewerArtifactTree["experiments"][number]["mutations"] = [];
  for (const mutationId of mutationIds) {
    const artifacts: ViewerArtifact[] = [];
    for (const fileName of MUTATION_FILES) {
      const relativePath = `experiments/${experimentId}/mutations/${mutationId}/${fileName}`;
      if (await fileExists(rootDir, relativePath)) {
        artifacts.push(toArtifact(relativePath, "mutation", experimentId, mutationId));
      }
    }
    mutations.push({ mutationId, artifacts });
  }
  return mutations;
}

async function listDocs(rootDir: string): Promise<string[]> {
  const docsDir = join(rootDir, "docs");
  try {
    const entries = await readdir(docsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => `docs/${entry.name}`)
      .sort();
  } catch {
    return [];
  }
}

async function fileExists(rootDir: string, relativePath: string): Promise<boolean> {
  try {
    const info = await stat(join(rootDir, ...relativePath.split("/")));
    return info.isFile();
  } catch {
    return false;
  }
}

function toArtifact(path: string, group: ViewerArtifact["group"], experimentId?: string, mutationId?: string): ViewerArtifact {
  return {
    id: path,
    label: path.startsWith("docs/") ? path : path.split("/").at(-1) ?? path,
    path,
    kind: kindFor(path),
    group,
    experimentId,
    mutationId
  };
}

function kindFor(path: string): ViewerArtifact["kind"] {
  if (path.endsWith(".md")) {
    return "markdown";
  }
  if (path.endsWith(".json")) {
    return "json";
  }
  return "text";
}
