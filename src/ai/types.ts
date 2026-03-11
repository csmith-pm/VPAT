export interface AiReviewResult {
  questionText: string;
  score: 1 | 0 | null;
  confidence: number; // 0-1
  reasoning: string;
  evidenceUsed: string[];
}

export interface AiReviewOptions {
  confidenceThreshold: number; // default 0.7
  model: string; // default 'claude-sonnet-4-20250514'
  maxConcurrentBatches: number; // default 2
}

export interface ScanEvidence {
  screenshots: Map<string, Buffer>;
  accessibilityTrees: Map<string, string>;
}

export const DEFAULT_AI_OPTIONS: AiReviewOptions = {
  confidenceThreshold: 0.7,
  model: 'claude-sonnet-4-20250514',
  maxConcurrentBatches: 2,
};
