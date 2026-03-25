/**
 * Grounding rules and validator for response quality assurance.
 * Ensures all agent outputs are factually anchored to corpus sources.
 */

/** The 10 canonical grounding rules enforced across all agents. */
export const GROUNDING_RULES: readonly string[] = [
  "Every factual claim must be traceable to a specific article in the corpus.",
  "Do not fabricate article titles, publication dates, authors, or URLs.",
  "When quoting directly, always include the article source and date.",
  "If a question cannot be answered from available articles, state this explicitly.",
  "Do not extrapolate or infer facts beyond what articles explicitly state.",
  "Distinguish clearly between summarized content and verbatim quotation.",
  "When articles conflict, present both perspectives with their respective sources.",
  "Quantitative figures (statistics, percentages, monetary amounts) require direct citation.",
  "Flag responses where corpus coverage may be outdated or incomplete.",
  "Do not attribute opinions or policy positions to agencies without textual evidence.",
] as const;

/** A source document used for grounding validation. */
export interface GroundingSource {
  /** Article identifier in the corpus. */
  id: string;
  /** Article title. */
  title: string;
  /** Publication date (ISO 8601). */
  date: string;
  /** Snippet of relevant text from the article. */
  snippet: string;
}

/** Result of validating a response against grounding rules. */
export interface GroundingValidationResult {
  /** Whether the response passes all critical grounding checks. */
  valid: boolean;
  /** Non-fatal grounding warnings. */
  warnings: string[];
  /** Grounding quality score from 0 to 1. */
  score: number;
}

/**
 * Validates a generated response against grounding rules and source documents.
 */
export class GroundingValidator {
  /**
   * Validate a response string against the provided source documents.
   *
   * @param response - The full response text to validate.
   * @param sources - The source documents that should ground the response.
   * @returns Validation result with validity flag, warnings, and score.
   */
  validate(
    response: string,
    sources: GroundingSource[],
  ): GroundingValidationResult {
    const warnings: string[] = [];
    let penaltyPoints = 0;

    // Check 1: response references at least one source
    if (sources.length === 0) {
      warnings.push("No source documents provided for grounding validation.");
      penaltyPoints += 30;
    }

    // Check 2: detect potential fabrication signals (common hallucination patterns)
    const fabricationPatterns = [
      /according to .{0,30}study/i,
      /research shows that/i,
      /experts say/i,
      /it is widely known/i,
      /statistics indicate/i,
    ];
    for (const pattern of fabricationPatterns) {
      if (pattern.test(response)) {
        // Only warn if source snippets don't contain supporting text
        const matchedText = (pattern.exec(response)?.[0] ?? "").toLowerCase();
        const hasSupport =
          matchedText.length > 0 &&
          sources.some((s) => s.snippet.toLowerCase().includes(matchedText));
        if (!hasSupport) {
          warnings.push(
            `Possible unsourced claim detected matching pattern: ${pattern.toString()}`,
          );
          penaltyPoints += 10;
        }
      }
    }

    // Check 3: citation markers present when sources are provided
    const hasCitationMarkers =
      /\[\d+\]|\[Source:|\[Ref:/i.test(response) || sources.length === 0;
    if (sources.length > 0 && !hasCitationMarkers) {
      warnings.push(
        "Response contains no citation markers despite source documents being provided.",
      );
      penaltyPoints += 20;
    }

    // Check 4: check for absolute superlatives without backing
    const superlatives = [
      "always",
      "never",
      "all agencies",
      "every department",
      "guaranteed",
    ];
    for (const term of superlatives) {
      if (response.toLowerCase().includes(term)) {
        warnings.push(
          `Absolute superlative "${term}" used — verify source support.`,
        );
        penaltyPoints += 5;
      }
    }

    // Check 5: response length sanity (empty or extremely short)
    if (response.trim().length < 50) {
      warnings.push("Response is suspiciously short and may be incomplete.");
      penaltyPoints += 15;
    }

    const score = Math.max(0, Math.min(1, 1 - penaltyPoints / 100));
    const valid = score >= 0.6 && penaltyPoints < 40;

    return { valid, warnings, score };
  }
}
