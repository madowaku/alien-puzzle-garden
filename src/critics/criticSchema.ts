export type CriticConfidence = "low" | "medium" | "high";

export type CriticTone =
  | "observatory"
  | "mathematician"
  | "skeptic"
  | "poet";

export type CriticProvider = "openai" | "mock" | "ollama";

export const criticTones: readonly CriticTone[] = [
  "observatory",
  "mathematician",
  "skeptic",
  "poet"
];

export const criticProviders: readonly CriticProvider[] = ["openai", "mock", "ollama"];

export type LlmCriticOutput = {
  summary: string;
  observedPatterns: Array<{
    title: string;
    evidence: string;
    confidence: CriticConfidence;
  }>;
  possibleInvariants: Array<{
    name: string;
    description: string;
    whyItMightMatter: string;
    confidence: CriticConfidence;
  }>;
  failureEcology: Array<{
    failureMode: string;
    evidence: string;
    possibleCause: string;
  }>;
  nextExperiments: Array<{
    title: string;
    change: string;
    expectedObservation: string;
  }>;
  mathFlavor: string[];
  humanMetaphor: string;
  madowakuNameCandidates: string[];
  cautions: string[];
};

const confidenceSchema = {
  type: "string",
  enum: ["low", "medium", "high"]
} as const;

export const llmCriticJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "observedPatterns",
    "possibleInvariants",
    "failureEcology",
    "nextExperiments",
    "mathFlavor",
    "humanMetaphor",
    "madowakuNameCandidates",
    "cautions"
  ],
  properties: {
    summary: { type: "string" },
    observedPatterns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "evidence", "confidence"],
        properties: {
          title: { type: "string" },
          evidence: { type: "string" },
          confidence: confidenceSchema
        }
      }
    },
    possibleInvariants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "whyItMightMatter", "confidence"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          whyItMightMatter: { type: "string" },
          confidence: confidenceSchema
        }
      }
    },
    failureEcology: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["failureMode", "evidence", "possibleCause"],
        properties: {
          failureMode: { type: "string" },
          evidence: { type: "string" },
          possibleCause: { type: "string" }
        }
      }
    },
    nextExperiments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "change", "expectedObservation"],
        properties: {
          title: { type: "string" },
          change: { type: "string" },
          expectedObservation: { type: "string" }
        }
      }
    },
    mathFlavor: {
      type: "array",
      items: { type: "string" }
    },
    humanMetaphor: { type: "string" },
    madowakuNameCandidates: {
      type: "array",
      items: { type: "string" }
    },
    cautions: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
