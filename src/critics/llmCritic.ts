import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCriticPrompt, type CriticInput } from "./buildCriticPrompt.ts";
import { llmCriticJsonSchema, type CriticTone, type LlmCriticOutput } from "./criticSchema.ts";

export type LlmCriticOptions = {
  apiKey: string;
  model?: string;
  tone?: CriticTone;
  fetchImpl?: typeof fetch;
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export async function runLlmCritic(input: CriticInput, options: LlmCriticOptions): Promise<LlmCriticOutput> {
  const prompt = buildCriticPrompt(input, { tone: options.tone });
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model ?? process.env.APG_CRITIC_MODEL ?? "gpt-5.2",
      input: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "alien_puzzle_llm_critic_output",
          strict: true,
          schema: llmCriticJsonSchema
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI critic request failed: ${response.status} ${response.statusText} ${body.slice(0, 500)}`);
  }

  const payload = await response.json() as OpenAIResponsePayload;
  return parseLlmCriticOutput(extractOutputText(payload));
}

export function parseLlmCriticOutput(text: string): LlmCriticOutput {
  const parsed = JSON.parse(text) as LlmCriticOutput;
  validateLlmCriticOutput(parsed);
  return parsed;
}

export async function writeLlmCriticOutputs(
  experimentDir: string,
  puzzleId: string,
  output: LlmCriticOutput,
  rawPayload: unknown = output
): Promise<void> {
  await writeFile(join(experimentDir, "llm_critic_raw.json"), `${JSON.stringify(rawPayload, null, 2)}\n`, "utf8");
  await writeFile(join(experimentDir, "llm_critic_report.md"), renderLlmCriticMarkdown(puzzleId, output), "utf8");
}

export function renderLlmCriticMarkdown(puzzleId: string, output: LlmCriticOutput): string {
  return `# LLM Critic Report: ${puzzleId}

## Summary

${output.summary}

## Observed Pattern Candidates

${output.observedPatterns.map((pattern, index) => `### Pattern Candidate: ${pattern.title}
Confidence: ${pattern.confidence}

Observed:
${pattern.evidence}

Interpretation:
${buildPatternInterpretation(pattern.title)}

Test:
${buildPatternTest(output, index)}`).join("\n\n") || "No observed pattern candidates were returned."}

## Possible Invariants

${output.possibleInvariants.map((item, index) => `### Invariant Candidate: ${item.name}
Status: not yet an invariant

Confidence: ${item.confidence}

Description:
${item.description}

Why it might matter:
${item.whyItMightMatter}

How to falsify:
${buildInvariantFalsification(output, index)}`).join("\n\n") || "No invariant candidates were returned."}

## Failure Ecology

${output.failureEcology.map((item) => `### ${item.failureMode}

Evidence:
${item.evidence}

Possible cause:
${item.possibleCause}`).join("\n\n") || "No failure ecology notes were returned."}

## Next Experiments

${output.nextExperiments.map((item) => `### ${item.title}

Change:
${item.change}

Expected observation:
${item.expectedObservation}`).join("\n\n") || "No next experiments were returned."}

## Possible Math Flavor

${output.mathFlavor.map((item) => `- ${item}`).join("\n") || "- No math flavor returned."}

## Human Metaphor

${output.humanMetaphor}

## madowaku Name Candidates

${output.madowakuNameCandidates.map((item) => `- ${item}`).join("\n") || "- No name candidates returned."}

## Cautions

${output.cautions.map((item) => `- ${item}`).join("\n") || "- Interpretive output only; not proof."}
`;
}

function buildPatternInterpretation(title: string): string {
  return `${title} is a pattern candidate observed in this batch, not a proof of a general property.`;
}

function buildPatternTest(output: LlmCriticOutput, index: number): string {
  const experiment = output.nextExperiments[index] ?? output.nextExperiments[0];
  if (!experiment) {
    return "Run a mutation test by changing the rule set, initial string, max steps, scoring weights, solver mix, or random seed count.";
  }
  return `${experiment.title}: ${experiment.change} Expected observation: ${experiment.expectedObservation}`;
}

function buildInvariantFalsification(output: LlmCriticOutput, index: number): string {
  const experiment = output.nextExperiments[index] ?? output.nextExperiments[0];
  if (!experiment) {
    return "Try a targeted mutation and check whether the candidate survives under variation.";
  }
  return `Try "${experiment.title}" and treat the candidate as weakened if the expected observation does not appear: ${experiment.expectedObservation}`;
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  if (payload.output_text) {
    return payload.output_text;
  }
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }
  throw new Error("OpenAI response did not contain output text.");
}

function validateLlmCriticOutput(output: LlmCriticOutput): void {
  const requiredArrays: Array<keyof LlmCriticOutput> = [
    "observedPatterns",
    "possibleInvariants",
    "failureEcology",
    "nextExperiments",
    "mathFlavor",
    "madowakuNameCandidates",
    "cautions"
  ];
  if (typeof output.summary !== "string" || typeof output.humanMetaphor !== "string") {
    throw new Error("Malformed critic output: missing summary or humanMetaphor.");
  }
  for (const key of requiredArrays) {
    if (!Array.isArray(output[key])) {
      throw new Error(`Malformed critic output: ${String(key)} must be an array.`);
    }
  }
}
