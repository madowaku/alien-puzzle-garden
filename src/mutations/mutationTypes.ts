export type MutationChangeType =
  | "remove_rule"
  | "alter_rule_output"
  | "alter_rule_input"
  | "seed_initial_symbol"
  | "remove_initial_symbol"
  | "change_max_steps"
  | "change_scoring_hint"
  | "increase_random_runs"
  | "change_solver_mix";

export type MutationPlan = {
  sourceExperimentId: string;
  sourcePattern: {
    name: string;
    status: "pattern_candidate" | "invariant_candidate" | "fallback_candidate";
    confidence: "low" | "medium" | "high";
  };
  hypothesis: string;
  planStatus: "proposed_not_run";
  mutations: Array<{
    id: string;
    title: string;
    changeType: MutationChangeType;
    rationale: string;
    change: Record<string, unknown>;
    expectedObservation: string;
    falsifiesIf: string;
    risk: string;
  }>;
  cautions: string[];
};

export type SurvivalStatus =
  | "survived"
  | "weakened"
  | "broken"
  | "inconclusive";

export type MutationResult = {
  sourceExperimentId: string;
  mutationId: string;
  title: string;
  changeType: MutationChangeType;
  status: SurvivalStatus;
  mutatedPuzzleId: string;
  comparison: {
    sourceBestScore: number;
    mutatedBestScore: number;
    bestScoreDelta: number;
    sourceAverageScore: number;
    mutatedAverageScore: number;
    averageScoreDelta: number;
    sourceDistinctFinalStates: number;
    mutatedDistinctFinalStates: number;
    distinctFinalStatesDelta: number;
    sourceAverageFinalLength: number;
    mutatedAverageFinalLength: number;
    averageFinalLengthDelta: number;
  };
  interpretation: string;
  cautions: string[];
};

export type SurvivalReport = {
  sourceExperimentId: string;
  sourcePatternName: string;
  hypothesis: string;
  planStatus: "run";
  results: MutationResult[];
  overallStatus: SurvivalStatus;
  summary: string;
  cautions: string[];
};

export type PatternSurvivalClass =
  | "robust_candidate"
  | "unstable_candidate"
  | "fragile_candidate"
  | "under_tested";

export type PatternSurvivalIndexEntry = {
  patternName: string;
  sourceExperimentIds: string[];
  mutationResultCount: number;
  statusCounts: Record<SurvivalStatus, number>;
  survivalScore: number;
  survivalClass: PatternSurvivalClass;
  robustAgainst: string[];
  fragileAgainst: string[];
  commonMutationTypes: string[];
  recommendation:
    | "rerun_with_more_mutations"
    | "promote_to_evolution_parent"
    | "rename_or_split_pattern"
    | "collect_more_data";
  notes: string[];
};

export type PatternSurvivalIndex = {
  generatedAt: string;
  experimentCount: number;
  mutationResultCount: number;
  statusCounts: Record<SurvivalStatus, number>;
  entries: PatternSurvivalIndexEntry[];
  cautions: string[];
};

export type EvolutionCandidateDecision =
  | "promote_to_parent"
  | "watchlist"
  | "rename_or_split"
  | "needs_more_tests";

export type EvolutionParentCandidate = {
  patternName: string;
  decision: EvolutionCandidateDecision;
  survivalScore: number;
  survivalClass: PatternSurvivalClass;
  mutationResultCount: number;
  sourceExperimentIds: string[];
  robustAgainst: string[];
  fragileAgainst: string[];
  recommendation: string;
  rationale: string;
  nextAction: string;
  cautions: string[];
};

export type EvolutionParentCandidatesReport = {
  generatedAt: string;
  sourceIndexPath: string;
  candidateCount: number;
  decisionCounts: Record<EvolutionCandidateDecision, number>;
  candidates: EvolutionParentCandidate[];
  cautions: string[];
};

export type NamingDebtReason =
  | "too_broad"
  | "rule_attached"
  | "score_attached"
  | "solver_attached"
  | "under_evidenced"
  | "split_candidate"
  | "mutation_sensitive";

export type NamingDebtEntry = {
  patternName: string;
  sourceDecision: EvolutionCandidateDecision;
  survivalScore: number;
  survivalClass: PatternSurvivalClass;
  mutationResultCount: number;
  debtReasons: NamingDebtReason[];
  fragileAgainst: string[];
  robustAgainst: string[];
  diagnosis: string;
  narrowerNameCandidates: string[];
  suggestedSplit: Array<{
    name: string;
    rationale: string;
    nextTest: string;
  }>;
  nextAction:
    | "rename"
    | "split"
    | "collect_more_mutations"
    | "keep_observing";
  cautions: string[];
};

export type NamingDebtReport = {
  generatedAt: string;
  sourceCandidatesPath: string;
  sourceIndexPath: string;
  entryCount: number;
  entries: NamingDebtEntry[];
  cautions: string[];
};
