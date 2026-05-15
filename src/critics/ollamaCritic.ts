import { buildCriticPrompt, type CriticInput } from "./buildCriticPrompt.ts";
import { parseLlmCriticOutput } from "./llmCritic.ts";
import type { CriticTone, LlmCriticOutput } from "./criticSchema.ts";

export type OllamaCriticOptions = {
  model?: string;
  baseUrl?: string;
  tone?: CriticTone;
  fetchImpl?: typeof fetch;
};

export type OllamaRawPayload = {
  provider: "ollama";
  model: string;
  baseUrl: string;
  parseFailed: boolean;
  rawText: string;
  parsedOutput?: LlmCriticOutput;
  error?: string;
};

export type OllamaCriticResult = {
  output: LlmCriticOutput;
  rawPayload: OllamaRawPayload;
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  response?: string;
  done?: boolean;
};

export async function runOllamaCritic(input: CriticInput, options: OllamaCriticOptions = {}): Promise<OllamaCriticResult> {
  const model = options.model ?? process.env.APG_CRITIC_MODEL ?? "qwen3.5";
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.APG_OLLAMA_BASE_URL ?? "http://localhost:11434");
  const prompt = buildCriticPrompt(input, { tone: options.tone });
  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [
            prompt.system,
            "Return only valid JSON matching the requested schema.",
            "Do not wrap the JSON in Markdown.",
            "Do not add commentary before or after the JSON.",
            "Do not include <think> tags.",
            "Do not include reasoning text outside JSON."
          ].join(" ")
        },
        { role: "user", content: prompt.user }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama critic request failed: ${response.status} ${response.statusText} ${body.slice(0, 500)}`);
  }

  const payload = await response.json() as OllamaChatResponse;
  const rawText = payload.message?.content ?? payload.response ?? "";
  return parseOllamaCriticText(rawText, { model, baseUrl, input });
}

export function parseOllamaCriticText(
  rawText: string,
  context: { model: string; baseUrl: string; input: CriticInput }
): OllamaCriticResult {
  const textWithoutThinkBlocks = stripThinkBlocks(rawText);
  const candidates = [
    rawText,
    textWithoutThinkBlocks,
    extractFencedJson(rawText),
    extractFencedJson(textWithoutThinkBlocks),
    extractBraceJson(rawText),
    extractBraceJson(textWithoutThinkBlocks)
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of candidates) {
    try {
      const parsedOutput = parseLlmCriticOutput(candidate);
      return {
        output: parsedOutput,
        rawPayload: {
          provider: "ollama",
          model: context.model,
          baseUrl: context.baseUrl,
          parseFailed: false,
          rawText,
          parsedOutput
        }
      };
    } catch {
      // Try the next extraction strategy.
    }
  }

  const output = buildFallbackOutput(rawText, context.input);
  return {
    output,
    rawPayload: {
      provider: "ollama",
      model: context.model,
      baseUrl: context.baseUrl,
      parseFailed: true,
      rawText,
      error: "Unable to parse Ollama response as LlmCriticOutput JSON."
    }
  };
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

function extractFencedJson(text: string): string | undefined {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  return match?.[1];
}

function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractBraceJson(text: string): string | undefined {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return undefined;
  }
  return text.slice(first, last + 1);
}

function buildFallbackOutput(rawText: string, input: CriticInput): LlmCriticOutput {
  const excerpt = rawText.trim().slice(0, 600) || "(empty Ollama response)";
  const firstRule = input.puzzle.rules[0]?.id ?? "R?";
  return {
    summary: `Ollama critic returned malformed JSON for ${input.puzzle.id}. A fallback observatory report was generated so the run can continue.`,
    observedPatterns: [
      {
        title: "Malformed Local Observation",
        evidence: `Raw local model excerpt: ${excerpt}`,
        confidence: "low"
      }
    ],
    possibleInvariants: [
      {
        name: "Unparsed Local Signal",
        description: "The local model response could not be converted into the critic schema.",
        whyItMightMatter: "Prompt tuning or a different local model may be needed before treating Ollama output as structured interpretation.",
        confidence: "low"
      }
    ],
    failureEcology: [
      {
        failureMode: "Schema drift",
        evidence: "The response did not parse as whole JSON, fenced JSON, or brace-delimited JSON.",
        possibleCause: "The local model may have added commentary or omitted required fields."
      }
    ],
    nextExperiments: [
      {
        title: "Tighten local JSON prompt",
        change: `Retry with the same experiment and model, or switch the model while keeping ${firstRule} unchanged.`,
        expectedObservation: "A usable local provider should produce parseable JSON matching the critic schema."
      }
    ],
    mathFlavor: ["local model parsing", "schema adherence", "observatory tooling"],
    humanMetaphor: "The local observer spoke through fog; the plate is preserved, but the constellation is not yet readable.",
    madowakuNameCandidates: ["Fogged Local Plate", "Schema Drift Gate"],
    cautions: [
      "Ollama parsing failed; this is fallback output.",
      "Raw local model text was preserved in llm_critic_raw.json.",
      "Do not treat this fallback as interpretation quality."
    ]
  };
}
