export type SymbolRewriteRule = {
  id: string;
  from: string;
  to: string;
};

export type SymbolRewritePuzzle = {
  id: string;
  type: "symbol_rewrite";
  alphabet: string[];
  initial: string;
  rules: SymbolRewriteRule[];
  maxSteps: number;
  objective: {
    primary: "maximize_score";
    secondary: "minimize_length";
  };
  scoreHints: string[];
};

export type SolverStep = {
  step: number;
  before: string;
  ruleId: string;
  ruleFrom: string;
  ruleTo: string;
  matchIndex: number;
  after: string;
};

export type SolverRun = {
  solverName: string;
  runId: string;
  steps: SolverStep[];
  finalState: string;
  score: number;
  finalLength: number;
  stoppedReason: "max_steps" | "no_moves";
};

export type ApplicableMove = {
  rule: SymbolRewriteRule;
  matchIndex: number;
  after: string;
};

export type PatternConfidence = "low" | "medium" | "high";

export type PatternObservation = {
  note: string;
  confidence: PatternConfidence;
};

export type ExperimentStats = {
  puzzleId: string;
  seed: number;
  runCount: number;
  bestScore: number;
  averageScore: number;
  bestFinalState: string;
  bestSolverName: string;
  averageFinalLength: number;
  distinctFinalStates: number;
  mostCommonFinalStates: Array<{
    state: string;
    count: number;
  }>;
  ruleUsageCounts: Record<string, number>;
  patternNotes: string[];
  patternObservations: PatternObservation[];
};

export type ExperimentSummary = {
  id: string;
  seed: number;
  bestScore: number;
  bestSolverName: string;
  distinctFinalStates: number;
  madowakuName: string;
};
