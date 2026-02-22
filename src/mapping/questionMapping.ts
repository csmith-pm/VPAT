import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { WcagToQuestionEntry } from '../types.js';

let cachedMapping: WcagToQuestionEntry[] | null = null;

/** Load the wcag-to-questions mapping from JSON */
export function loadQuestionMapping(
  mappingPath: string = resolve(import.meta.dirname, '../../mappings/wcag-to-questions.json')
): WcagToQuestionEntry[] {
  if (cachedMapping) return cachedMapping;

  if (!existsSync(mappingPath)) {
    throw new Error(
      `wcag-to-questions.json not found at ${mappingPath}. Run: npx tsx scripts/dump-template-questions.ts`
    );
  }

  cachedMapping = JSON.parse(readFileSync(mappingPath, 'utf-8')) as WcagToQuestionEntry[];
  return cachedMapping;
}

/** Find a question mapping entry for a given WCAG SC */
export function findQuestionEntry(sc: string): WcagToQuestionEntry | undefined {
  const mapping = loadQuestionMapping();
  return mapping.find((e) => e.wcagSc === sc);
}

/** Get all automatable questions */
export function getAutomatableQuestions(): WcagToQuestionEntry[] {
  const mapping = loadQuestionMapping();
  return mapping.filter((e) => e.questions.some((q) => q.automatable));
}
