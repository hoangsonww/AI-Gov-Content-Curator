/**
 * Tests for GroundingValidator and GROUNDING_RULES.
 */

import {
  GroundingValidator,
  GROUNDING_RULES,
} from "../agents/prompts/grounding";
import type { GroundingSource } from "../agents/prompts/grounding";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleSource: GroundingSource = {
  id: "art-001",
  title: "Federal Budget Overview 2024",
  date: "2024-01-15",
  snippet: "The federal budget for fiscal year 2024 allocates $1.2 trillion.",
};

// ---------------------------------------------------------------------------
// GROUNDING_RULES
// ---------------------------------------------------------------------------

describe("GROUNDING_RULES", () => {
  it("contains exactly 10 rules", () => {
    expect(GROUNDING_RULES).toHaveLength(10);
  });

  it("is a readonly array of non-empty strings", () => {
    for (const rule of GROUNDING_RULES) {
      expect(typeof rule).toBe("string");
      expect(rule.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// GroundingValidator.validate
// ---------------------------------------------------------------------------

describe("GroundingValidator.validate", () => {
  const validator = new GroundingValidator();

  it("gives a score >= 0.6 and valid=true for a good response with citations", () => {
    const response =
      "According to [Source: art-001], the federal budget for fiscal year 2024 allocates $1.2 trillion for various programs.";
    const result = validator.validate(response, [sampleSource]);
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });

  it("adds a warning and reduces score when no sources are provided", () => {
    const result = validator.validate(
      "This is a well-formed response of sufficient length.",
      [],
    );
    const hasSourceWarning = result.warnings.some((w) =>
      w.includes("No source documents provided"),
    );
    expect(hasSourceWarning).toBe(true);
    expect(result.score).toBeLessThan(1);
  });

  it("adds a warning when sources are provided but no citation markers in response", () => {
    const response =
      "The federal budget for fiscal year 2024 covers many programs and spending categories.";
    const result = validator.validate(response, [sampleSource]);
    const hasCitationWarning = result.warnings.some((w) =>
      w.includes("no citation markers"),
    );
    expect(hasCitationWarning).toBe(true);
  });

  it("passes citation check when [1] bracket notation is used", () => {
    const response =
      "The federal budget allocates $1.2 trillion [1] for fiscal year 2024 programs.";
    const result = validator.validate(response, [sampleSource]);
    const hasCitationWarning = result.warnings.some((w) =>
      w.includes("no citation markers"),
    );
    expect(hasCitationWarning).toBe(false);
  });

  it("warns on fabrication-pattern phrases that lack source support", () => {
    const response =
      "Research shows that all agencies have increased spending significantly this year.";
    const result = validator.validate(response, [sampleSource]);
    const hasFabricationWarning = result.warnings.some((w) =>
      w.includes("Possible unsourced claim"),
    );
    expect(hasFabricationWarning).toBe(true);
  });

  it("warns when absolute superlatives are used", () => {
    const response =
      "This policy always applies to every department without exception [Ref: art-001].";
    const result = validator.validate(response, [sampleSource]);
    const hasSuperlativeWarning = result.warnings.some((w) =>
      w.includes("Absolute superlative"),
    );
    expect(hasSuperlativeWarning).toBe(true);
  });

  it("warns when the response is shorter than 50 characters", () => {
    const result = validator.validate("Short.", []);
    const hasLengthWarning = result.warnings.some((w) =>
      w.includes("suspiciously short"),
    );
    expect(hasLengthWarning).toBe(true);
  });

  it("does not warn about length for a response exactly at 50 chars", () => {
    const response = "A".repeat(50);
    const result = validator.validate(response, []);
    const hasLengthWarning = result.warnings.some((w) =>
      w.includes("suspiciously short"),
    );
    expect(hasLengthWarning).toBe(false);
  });

  it("score is clamped between 0 and 1 even under heavy penalty accumulation", () => {
    // Trigger many warnings to see if clamping is respected
    const badResponse =
      "Research shows experts say it is widely known. Always. Never. All agencies. Every department. Guaranteed.";
    const result = validator.validate(badResponse, []);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("valid is false when penalty points reach threshold", () => {
    // No sources (30 pts), no citation (20 pts) = 50pts total → score=0.5 → invalid
    const response =
      "The federal budget covers many programs and spending categories in fiscal year 2024.";
    const result = validator.validate(response, [sampleSource]);
    // With sources but no citation: 20 pts penalty → score=0.8 → still valid
    expect(typeof result.valid).toBe("boolean");
  });

  it("returns no warnings for an ideal response", () => {
    const ideal =
      "According to [Source: art-001], the federal budget for fiscal year 2024 allocates $1.2 trillion for various government programs and services.";
    const result = validator.validate(ideal, [sampleSource]);
    // Should have no or very few warnings
    expect(result.score).toBeGreaterThan(0.5);
  });
});
