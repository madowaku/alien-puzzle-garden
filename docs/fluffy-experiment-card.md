# Fluffy Experiment Card

This note sketches a lightweight bridge between Alien Puzzle Garden and a later laboratory layer.

It is a conceptual schema and handoff memo, not a locked implementation spec. Field names, pipeline shape, and selection rules can change as APG learns better ways to observe its own traces.

## Purpose

A Fluffy Experiment Card is a small, human-readable wrapper around an APG phenomenon that looks worth carrying out of the garden.

The card should preserve the looseness of the garden while making the next laboratory action easier to choose. It does not need to prove that a pattern is important. It only says:

- something happened in the garden
- APG has a local reason to keep or discard it
- the next environment should know how to handle it

In v0.2.15 Candidate terms, this belongs to the **Fluffy Laboratory Bridge**: a soft handoff from AI-native garden observation to more deliberate laboratory inspection.

## Position In The Flow

The card sits after APG has produced enough local context to describe a candidate without pretending it is already research-grade.

Possible upstream inputs:

- `alien_trace.json`
- `translation_gate.json`
- `trace_atlas.json`
- `research_signal_index.json`
- `survival_report.json`
- `naming_debt_report.json`
- `garden_program.md`

Possible downstream uses:

- choose whether a pattern should be planted into a future experiment
- decide whether a failure should be preserved as a specimen
- collect candidates for a laboratory notebook
- mark which observations are not ready for paper-scale automation

The card is intentionally between layers:

```txt
Garden traces
  -> trace atlas / survival / naming debt
  -> Fluffy Experiment Card
  -> laboratory handoff memo
```

## Card Fields Draft

These fields are provisional. A later implementation may split, rename, or remove them.

```ts
type FluffyExperimentCard = {
  cardId: string;
  sourceExperimentIds: string[];
  sourceArtifacts: string[];
  gardenName: string;
  shortDescription: string;
  observedWhy: string;
  localEvidence: string[];
  uncertainty: "low" | "medium" | "high";
  failureAsSpecimen?: {
    isFailureSpecimen: boolean;
    whyPreserve: string;
  };
  suggestedHandoffAction: "plant" | "compost" | "preserve" | "escalate";
  laboratoryQuestion: string;
  nonClaims: string[];
};
```

Draft field meanings:

- `cardId`: stable local identifier for this card.
- `sourceExperimentIds`: APG experiments that produced the observation.
- `sourceArtifacts`: files that justify the card.
- `gardenName`: the current soft name, not a final concept name.
- `shortDescription`: one or two sentences for a human gardener.
- `observedWhy`: why APG surfaced this candidate.
- `localEvidence`: local traces, scores, mutation outcomes, or naming-debt signals.
- `uncertainty`: how fragile the interpretation is.
- `failureAsSpecimen`: optional block for failures worth preserving.
- `suggestedHandoffAction`: the next bridge action.
- `laboratoryQuestion`: the smallest question a later lab layer should ask.
- `nonClaims`: things the card explicitly does not claim.

## Handoff Actions

### plant

Use when the candidate looks ready to seed another local APG experiment.

This does not mean the pattern is important. It means the garden has enough signal to try growing it under new conditions.

Example use:

- robust or recurring trace family
- clear parent-candidate signal
- useful connection to the garden program

### compost

Use when the candidate should return to the garden as material rather than move forward as a named object.

Compost is not deletion. It means the observation may still improve future generation, scoring, naming, or trace grouping, but the current name should not be promoted.

Example use:

- too broad
- low evidence
- noisy local artifact
- naming debt with no clean split yet

### preserve

Use when the candidate is not ready to grow, but the trace is valuable as a specimen.

Preserve is especially useful for failures, weird solver collapses, malformed critic output, brittle mutation results, or quiet traces that might become meaningful later.

Example use:

- failure-as-specimen
- rare broken pattern with clear cause
- local LLM oddity worth comparing later
- trace that should remain AI-native for now

### escalate

Use when the candidate is ready for a more deliberate laboratory pass.

Escalation should be rare in early APG. It asks for more careful framing, comparison, or external vocabulary search, not automatic paper generation.

Example use:

- repeated pattern survives multiple mutation families
- external research signal suggests a vocabulary bridge
- human gardener wants a focused laboratory memo

## Failure-As-Specimen

APG should treat certain failures as specimens, not waste.

A failed run, broken pattern, malformed interpretation, or fragile name can still show where the garden's behavior changes sharply. The point is not to rescue every failure into meaning. The point is to keep failures that teach the next experiment where pressure mattered.

Failure-as-specimen cards should answer:

- what broke
- what pressure broke it
- whether the break is repeatable locally
- why preserving it may help future garden or laboratory work

They should avoid saying:

- the failure proves a theory
- the failure is mathematically important
- the failure should become a paper

In APG language, a broken candidate can still be a useful fossil.

## Non-Goals

Fluffy Experiment Cards are not meant to create paper-scale automation.

They should not:

- turn every interesting trace into a research claim
- replace local mutation pressure with external vocabulary
- make APG depend on network access
- make `npm run experiment` require a critic, harvester, LLM, or browser
- force AI-native traces into human-readable explanations too early
- lock the future schema before the garden has enough experience

The local-first core remains intact. The card is only a soft bridge: a way to decide what might leave the garden, what should stay, and what should be preserved because it failed in an informative way.
