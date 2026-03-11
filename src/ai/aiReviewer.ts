import Anthropic from '@anthropic-ai/sdk';
import type { QuestionScore, WcagScResult, DetailedScanResult } from '../types.js';
import type { AiReviewResult, AiReviewOptions, ScanEvidence } from './types.js';
import { DEFAULT_AI_OPTIONS } from './types.js';
import { groupQuestionsBySection, buildMessages } from './promptBuilder.js';

/** Review manual questions using Claude API */
export async function reviewManualQuestions(
  scores: QuestionScore[],
  wcagResults: Map<string, WcagScResult>,
  scanResults: DetailedScanResult[],
  evidence: ScanEvidence | undefined,
  options: Partial<AiReviewOptions> = {},
  onProgress?: (completed: number, total: number) => void
): Promise<AiReviewResult[]> {
  const opts = { ...DEFAULT_AI_OPTIONS, ...options };

  const client = new Anthropic();
  const batches = groupQuestionsBySection(scores, wcagResults, scanResults);

  if (batches.length === 0) return [];

  const allResults: AiReviewResult[] = [];
  let completed = 0;

  // Process batches in chunks with concurrency limit
  for (let i = 0; i < batches.length; i += opts.maxConcurrentBatches) {
    const chunk = batches.slice(i, i + opts.maxConcurrentBatches);
    const promises = chunk.map(async (batch) => {
      try {
        const { system, userMessage } = buildMessages(batch, scanResults, evidence);
        const results = await callClaudeWithRetry(client, system, userMessage, opts.model);
        allResults.push(...results);
      } catch (error) {
        // Graceful degradation: log warning, leave scores as null
        console.warn(
          `Warning: AI review failed for WCAG section ${batch.wcagSection}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      completed++;
      onProgress?.(completed, batches.length);
    });
    await Promise.all(promises);
  }

  return allResults;
}

/** Call Claude API with one retry on parse failure */
async function callClaudeWithRetry(
  client: Anthropic,
  system: string,
  userMessage: string,
  model: string,
  retryCount = 0
): Promise<AiReviewResult[]> {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  try {
    return parseAiResponse(text);
  } catch (parseError) {
    if (retryCount < 1) {
      // Retry once with a nudge
      const retryResponse = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: text },
          { role: 'user', content: 'Your response was not valid JSON. Please respond with ONLY a JSON array of objects as specified. No markdown fences, no extra text.' },
        ],
      });

      const retryText = retryResponse.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      return parseAiResponse(retryText);
    }
    throw parseError;
  }
}

/** Parse and validate AI response JSON */
function parseAiResponse(text: string): AiReviewResult[] {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not a JSON array');
  }

  return parsed.map((item: any) => ({
    questionText: String(item.questionText ?? ''),
    score: item.score === 1 ? 1 : item.score === 0 ? 0 : null,
    confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0,
    reasoning: String(item.reasoning ?? ''),
    evidenceUsed: Array.isArray(item.evidenceUsed) ? item.evidenceUsed.map(String) : [],
  }));
}

/** Merge AI results into the scores array */
export function mergeAiResults(
  scores: QuestionScore[],
  aiResults: AiReviewResult[],
  confidenceThreshold: number
): { scored: number; belowThreshold: number } {
  let scored = 0;
  let belowThreshold = 0;

  for (const aiResult of aiResults) {
    // Find matching question in scores
    const match = scores.find(s =>
      s.score === null && textsOverlap(s.questionText, aiResult.questionText)
    );

    if (!match) continue;

    if (aiResult.score !== null && aiResult.confidence >= confidenceThreshold) {
      match.score = aiResult.score;
      match.weightedScore = match.weight * aiResult.score;
      // Comments stay empty — reserved for human reviewer
      match.comment = '';
      scored++;
    } else {
      // Below threshold — leave as null (renders as *)
      belowThreshold++;
    }
  }

  return { scored, belowThreshold };
}

/** Check if two question texts overlap enough to be a match */
function textsOverlap(a: string, b: string): boolean {
  const normalize = (t: string) => t.replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim().toLowerCase();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;

  const wordsA = na.split(/\s+/).filter(w => w.length > 2);
  const wordsB = nb.split(/\s+/).filter(w => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const matchCount = wordsA.filter(w => wordsB.some(bw => bw.includes(w) || w.includes(bw))).length;
  return matchCount / Math.max(wordsA.length, wordsB.length) > 0.7;
}
