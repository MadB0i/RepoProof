import { Rule, RuleResult, ScanContext, Category } from "../types.js";

const MAX_CONCURRENCY = 4;
const MAX_FINDINGS_PER_RULE = 50;

export async function runRules(rules: Rule[], context: ScanContext): Promise<RuleResult[]> {
  const config = context.config;
  const enabledRules = rules.filter((r) => !(config.disabledRules ?? []).includes(r.id));

  const allResults: RuleResult[] = [];

  // Run rules with bounded concurrency
  for (let i = 0; i < enabledRules.length; i += MAX_CONCURRENCY) {
    const batch = enabledRules.slice(i, i + MAX_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((rule) => {
        try {
          return rule.run(context);
        } catch {
          return [] as RuleResult[];
        }
      }),
    );

    for (const results of batchResults) {
      // Cap findings per rule
      const capped = results.slice(0, MAX_FINDINGS_PER_RULE);

      // Apply severity overrides
      for (const result of capped) {
        if (config.severityOverrides?.[result.id]) {
          result.severity = config.severityOverrides[result.id];
        }
        if (config.penaltyOverrides?.[result.id]) {
          result.scorePenalty = config.penaltyOverrides[result.id];
        }
      }

      allResults.push(...capped);
    }
  }

  return allResults;
}

export function calculateScore(
  results: RuleResult[],
  categoryLimits?: Partial<Record<Category, number>>,
): {
  score: number;
  categoryScores: Record<Category, { score: number; maxScore: number; findings: number }>;
} {
  const categories: Category[] = [
    "incomplete-implementation",
    "tests",
    "security-configuration",
    "error-handling-reliability",
    "repository-readiness",
  ];

  const defaultLimits: Record<Category, number> = {
    "incomplete-implementation": 20,
    tests: 20,
    "security-configuration": 30,
    "error-handling-reliability": 15,
    "repository-readiness": 15,
  };

  const limits = { ...defaultLimits, ...categoryLimits };
  const maxScore = 100;

  const categoryScores = {} as Record<
    Category,
    { score: number; maxScore: number; findings: number }
  >;

  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const totalPenalty = catResults.reduce((sum, r) => sum + r.scorePenalty, 0);
    const cappedPenalty = Math.min(totalPenalty, limits[cat]);
    categoryScores[cat] = {
      score: Math.max(0, limits[cat] - cappedPenalty),
      maxScore: limits[cat],
      findings: catResults.length,
    };
  }

  const totalScore = Math.max(
    0,
    maxScore - Object.values(categoryScores).reduce((sum, c) => sum + (c.maxScore - c.score), 0),
  );

  return { score: totalScore, categoryScores };
}

export function getResultsBySeverity(results: RuleResult[]) {
  return {
    errors: results.filter((r) => r.severity === "error"),
    warnings: results.filter((r) => r.severity === "warning"),
    info: results.filter((r) => r.severity === "info"),
  };
}
