import type { QuestionScore, WcagScResult, DetailedScanResult } from '../types.js';
import type { ScanEvidence } from './types.js';
import { loadQuestionMapping } from '../mapping/questionMapping.js';

export interface QuestionBatch {
  wcagSection: string;
  questions: QuestionScore[];
  wcagResults: WcagScResult[];
  scanSummary: string;
}

const SYSTEM_PROMPT = `You are a WCAG 2.1 accessibility auditor reviewing automated scan results to assess conformance questions.

You will receive:
- A set of WCAG conformance questions with their weights
- Automated scan data including pass/fail/incomplete counts per URL
- Violation details with CSS selectors, HTML snippets, and failure summaries

For each question, determine:
- score: 1 (supports/conforms), 0 (does not support), or null (insufficient evidence)
- confidence: 0.0 to 1.0 reflecting how certain you are
- reasoning: brief explanation of your assessment
- evidenceUsed: which evidence informed your decision

IMPORTANT GUIDELINES:
- Be conservative: return null when evidence is insufficient rather than guessing
- A question can score 1 (supports) even if minor issues exist, if the core requirement is met
- A question should score 0 only when there is clear evidence of non-conformance
- Consider whether violations are relevant to the specific question being asked
- Some questions require manual testing (keyboard navigation, screen reader behavior, cognitive aspects) — return null for these unless scan data provides strong indirect evidence

Respond with a JSON array of objects, one per question. Each object must have:
{
  "questionText": "the exact question text",
  "score": 1 | 0 | null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "evidenceUsed": ["list", "of", "evidence", "types"]
}

Return ONLY the JSON array, no other text.`;

/** Group manual questions by WCAG section for batched API calls */
export function groupQuestionsBySection(
  scores: QuestionScore[],
  wcagResults: Map<string, WcagScResult>,
  scanResults: DetailedScanResult[]
): QuestionBatch[] {
  // Filter to null-score (manual review) questions only
  const manualQuestions = scores.filter(s => s.score === null);
  if (manualQuestions.length === 0) return [];

  // Group by WCAG section prefix (e.g., "1.1", "1.3", "2.1")
  const sectionMap = new Map<string, QuestionScore[]>();

  for (const q of manualQuestions) {
    // Extract section from question context — find its WCAG SC
    const section = findQuestionSection(q, scores);
    const existing = sectionMap.get(section) ?? [];
    existing.push(q);
    sectionMap.set(section, existing);
  }

  const scanSummary = buildScanSummary(scanResults);
  const batches: QuestionBatch[] = [];

  for (const [section, questions] of sectionMap) {
    // Find relevant WCAG results for this section
    const relevantResults: WcagScResult[] = [];
    for (const [sc, result] of wcagResults) {
      if (sc.startsWith(section + '.') || sc === section) {
        relevantResults.push(result);
      }
    }

    batches.push({
      wcagSection: section,
      questions,
      wcagResults: relevantResults,
      scanSummary,
    });
  }

  return batches;
}

/** Find the WCAG section for a question by matching against the question mapping */
function findQuestionSection(question: QuestionScore, _allScores: QuestionScore[]): string {
  const mapping = loadQuestionMapping();

  // Search mapping entries for a matching question text
  for (const entry of mapping) {
    for (const q of entry.questions) {
      const normalize = (t: string) => t.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim().toLowerCase();
      const a = normalize(question.questionText);
      const b = normalize(q.questionText);
      if (a === b) return entry.wcagSc;

      // Fuzzy match
      const wordsA = a.split(/\s+/).filter(w => w.length > 2);
      const wordsB = b.split(/\s+/).filter(w => w.length > 2);
      if (wordsA.length > 0 && wordsB.length > 0) {
        const matchCount = wordsA.filter(w => wordsB.some(bw => bw.includes(w) || w.includes(bw))).length;
        if (matchCount / Math.max(wordsA.length, wordsB.length) > 0.7) {
          return entry.wcagSc;
        }
      }
    }
  }

  // Fall back to grouping by table index
  return `table-${question.tableIndex}`;
}

/** Build a text summary of scan results for context */
function buildScanSummary(scanResults: DetailedScanResult[]): string {
  const lines: string[] = [];
  lines.push(`Scanned ${scanResults.length} URLs.`);

  const totalViolations = scanResults.reduce((sum, r) => sum + r.violations.length, 0);
  const totalPasses = scanResults.reduce((sum, r) => sum + r.passes.length, 0);
  const totalIncomplete = scanResults.reduce((sum, r) => sum + r.incomplete.length, 0);

  lines.push(`Total: ${totalViolations} violation rules, ${totalPasses} passing rules, ${totalIncomplete} incomplete rules.`);
  lines.push('');

  // Per-URL summary
  for (const result of scanResults) {
    const urlShort = result.url.replace(/https?:\/\//, '').substring(0, 60);
    lines.push(`${urlShort}: ${result.violations.length} violations, ${result.passes.length} passes, ${result.incomplete.length} incomplete`);
  }

  return lines.join('\n');
}

/** Build violation details text for a WCAG section */
function buildViolationDetails(
  wcagResults: WcagScResult[],
  scanResults: DetailedScanResult[],
  wcagSection: string
): string {
  const lines: string[] = [];

  for (const result of wcagResults) {
    lines.push(`WCAG ${result.sc}: status=${result.status}, violations=${result.totalViolations}, urls_affected=${result.urlsWithViolations}/${result.totalUrls}`);
    if (result.topIssues.length > 0) {
      lines.push(`  Top issues: ${result.topIssues.join('; ')}`);
    }
  }

  // Add detailed violation info from scan results
  for (const scan of scanResults) {
    for (const v of scan.violationDetails) {
      // Check if this violation maps to the current WCAG section
      const matchesSection = v.wcagTags.some(tag => {
        const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
        if (!match) return false;
        const sc = `${match[1]}.${match[2]}`;
        return sc === wcagSection;
      });

      if (matchesSection && v.nodeDetails.length > 0) {
        lines.push('');
        lines.push(`Rule: ${v.ruleId} — ${v.help}`);
        lines.push(`Impact: ${v.impact}`);
        // Show up to 3 node examples
        for (const node of v.nodeDetails.slice(0, 3)) {
          lines.push(`  Selector: ${node.target.join(' > ')}`);
          lines.push(`  HTML: ${node.html.substring(0, 200)}`);
          lines.push(`  Fix: ${node.failureSummary}`);
        }
        if (v.nodeDetails.length > 3) {
          lines.push(`  ... and ${v.nodeDetails.length - 3} more nodes`);
        }
      }
    }
  }

  return lines.join('\n');
}

/** Build the messages array for a single batch API call */
export function buildMessages(
  batch: QuestionBatch,
  scanResults: DetailedScanResult[],
  _evidence?: ScanEvidence
): { system: string; userMessage: string } {
  const questionList = batch.questions.map((q, i) =>
    `${i + 1}. [Weight: ${q.weight}] "${q.questionText}"`
  ).join('\n');

  const violationDetails = buildViolationDetails(batch.wcagResults, scanResults, batch.wcagSection);

  const userMessage = `## WCAG Section: ${batch.wcagSection}

### Questions to assess:
${questionList}

### Scan Summary:
${batch.scanSummary}

### Violation Details for Section ${batch.wcagSection}:
${violationDetails || 'No violations or passes detected for this section.'}`;

  return { system: SYSTEM_PROMPT, userMessage };
}
