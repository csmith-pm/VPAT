import type { WcagScResult, QuestionScore, ParsedProduct } from '../types.js';
import { loadQuestionMapping } from './questionMapping.js';

/** Generate scores for all questions in a product based on axe scan results */
export function scoreQuestions(
  product: ParsedProduct,
  wcagResults: Map<string, WcagScResult>,
  carryForwardScores?: Map<string, QuestionScore>
): QuestionScore[] {
  const questionMapping = loadQuestionMapping();
  const scores: QuestionScore[] = [];

  // Build a lookup of section → SC (e.g., "1.1" → questions under that section)
  for (const table of product.tables) {
    let currentSection = '';
    let currentScPrefix = '';

    for (const row of table.rows) {
      if (row.type === 'section') {
        currentSection = row.sectionName || '';
        const scMatch = currentSection.match(/^(\d+\.\d+):/);
        currentScPrefix = scMatch ? scMatch[1] : '';
      } else if (row.type === 'question' && row.questionText) {
        const questionText = row.questionText;
        const weight = row.weight || 0;

        // Find this question in the mapping
        const mappingEntry = questionMapping.find((e) => e.wcagSc === currentScPrefix);
        const questionDef = mappingEntry?.questions.find(
          (q) => textsMatch(questionText, q.questionText)
        );

        let score: number | null = null;
        let comment = '';
        const automatable = questionDef?.automatable ?? false;

        if (automatable && questionDef) {
          // Find relevant WCAG SC results
          const relevantResults = findRelevantResults(
            currentScPrefix,
            questionDef.axeRules,
            wcagResults
          );

          if (relevantResults.length > 0) {
            const hasFailures = relevantResults.some((r) => r.status === 'fail');
            const hasIncomplete = relevantResults.some((r) => r.status === 'incomplete');

            if (hasFailures) {
              score = 0;
              const failResults = relevantResults.filter((r) => r.status === 'fail');
              const totalViolations = failResults.reduce((sum, r) => sum + r.totalViolations, 0);
              const urlCount = new Set(failResults.map((r) => r.urlsWithViolations)).size;
              const topIssues = failResults.flatMap((r) => r.topIssues).slice(0, 3);
              comment = `Found ${totalViolations} violation(s) across ${urlCount} page(s). Issues: ${topIssues.join('; ')}`;
            } else if (hasIncomplete) {
              score = null;
              comment = 'Requires manual review — axe-core returned incomplete results.';
            } else {
              score = 1;
              const totalUrls = relevantResults[0]?.totalUrls ?? 0;
              comment = `No issues found across ${totalUrls} page(s).`;
            }
          } else {
            // No axe results for this SC — may not be testable by axe
            score = null;
            comment = 'No automated test coverage for this criterion.';
          }
        } else {
          // Non-automatable question — preserve existing template values if present
          const existingScore = row.score?.trim();
          const existingComment = row.comment?.trim();

          if (existingScore === '1' || existingScore === '0') {
            score = parseInt(existingScore, 10);
            comment = existingComment || '';
          } else if (carryForwardScores) {
            const cfScore = carryForwardScores.get(`${table.tableIndex}:${row.rowIndex}`);
            if (cfScore && cfScore.score !== null) {
              score = cfScore.score;
              comment = cfScore.comment || '';
            } else {
              score = null;
              comment = existingComment || 'Manual review required.';
            }
          } else {
            score = null;
            comment = existingComment || 'Manual review required.';
          }
        }

        const weightedScore = score !== null ? weight * score : null;

        scores.push({
          rowIndex: row.rowIndex,
          tableIndex: table.tableIndex,
          questionText,
          score,
          weight,
          weightedScore,
          comment,
          automatable,
        });
      }
    }
  }

  return scores;
}

/** Find WCAG results relevant to a question */
function findRelevantResults(
  scPrefix: string,
  axeRules: string[],
  wcagResults: Map<string, WcagScResult>
): WcagScResult[] {
  const results: WcagScResult[] = [];

  // Look for exact SC matches (e.g. "1.1" matches "1.1.1")
  for (const [sc, result] of wcagResults) {
    if (sc.startsWith(scPrefix + '.') || sc === scPrefix) {
      results.push(result);
    }
  }

  return results;
}

/** Normalize question text for matching — handles garbled chars like alter*tive */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase();
}

/** Fuzzy match: check if two question texts are similar enough (handles template garbling) */
function textsMatch(templateText: string, mappingText: string): boolean {
  const a = normalizeText(templateText);
  const b = normalizeText(mappingText);
  if (a === b) return true;

  // Try matching with wildcards for garbled chars (template has * for missing chars)
  // Build a regex from template text, replacing runs of missing chars with .*
  const templateClean = templateText.replace(/\s+/g, ' ').trim().toLowerCase();
  const mappingClean = mappingText.replace(/\s+/g, ' ').trim().toLowerCase();

  // Check if first N significant words match
  const aWords = a.split(/\s+/).filter(w => w.length > 2);
  const bWords = b.split(/\s+/).filter(w => w.length > 2);
  if (aWords.length === 0 || bWords.length === 0) return false;

  // Count matching words (order-independent)
  const matchCount = aWords.filter(w => bWords.some(bw => bw.includes(w) || w.includes(bw))).length;
  const matchRatio = matchCount / Math.max(aWords.length, bWords.length);

  return matchRatio > 0.7;
}

/** Generate a summary of scoring results */
export function scoringSummary(scores: QuestionScore[]): {
  total: number;
  automated: number;
  manual: number;
  passing: number;
  failing: number;
  na: number;
} {
  const automated = scores.filter((s) => s.automatable);
  const manual = scores.filter((s) => !s.automatable);
  const passing = scores.filter((s) => s.score === 1);
  const failing = scores.filter((s) => s.score === 0);
  const na = scores.filter((s) => s.score === null);

  return {
    total: scores.length,
    automated: automated.length,
    manual: manual.length,
    passing: passing.length,
    failing: failing.length,
    na: na.length,
  };
}
