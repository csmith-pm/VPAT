/**
 * One-off script to apply extracted weights from the original template
 * into mappings/wcag-to-questions.json.
 *
 * Matches questions by wcagSc + question index within each section.
 *
 * Usage: npx tsx scripts/apply-weights.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { parseTemplate, extractQuestions } from '../src/docx/reader.js';
import type { WcagToQuestionEntry } from '../src/types.js';

const TEMPLATE_PATH = resolve(import.meta.dirname, '../templates/H2 2024 ClearGov Overall ACR .docx');
const MAPPING_PATH = resolve(import.meta.dirname, '../mappings/wcag-to-questions.json');
const PRODUCT_INDEX = 1; // Transparency

async function main() {
  // Extract weights from original template
  const { products } = await parseTemplate(TEMPLATE_PATH);
  const product = products[PRODUCT_INDEX];
  console.log(`Product: ${product.name}`);

  const templateQuestions = extractQuestions(product);

  // Group template questions by wcagSc prefix (e.g. "1.1")
  const templateBySection = new Map<string, typeof templateQuestions>();
  for (const q of templateQuestions) {
    const existing = templateBySection.get(q.wcagSc) || [];
    existing.push(q);
    templateBySection.set(q.wcagSc, existing);
  }

  // Load mapping JSON
  const mapping: WcagToQuestionEntry[] = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'));

  let matched = 0;
  let unmatched = 0;

  for (const entry of mapping) {
    const sectionQuestions = templateBySection.get(entry.wcagSc);
    if (!sectionQuestions) {
      console.warn(`No template questions for section ${entry.wcagSc}`);
      for (const q of entry.questions) {
        (q as any).weight = 2; // fallback
      }
      unmatched += entry.questions.length;
      continue;
    }

    for (let i = 0; i < entry.questions.length; i++) {
      if (i < sectionQuestions.length) {
        (entry.questions[i] as any).weight = sectionQuestions[i].weight;
        matched++;
      } else {
        console.warn(`No template match for question ${i} in section ${entry.wcagSc}: "${entry.questions[i].questionText.substring(0, 50)}..."`);
        (entry.questions[i] as any).weight = 2; // fallback
        unmatched++;
      }
    }
  }

  console.log(`\nMatched: ${matched}, Unmatched: ${unmatched}`);

  // Write updated mapping
  writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2) + '\n');
  console.log(`Updated ${MAPPING_PATH}`);
}

main().catch(console.error);
