/**
 * One-off script to extract per-question weights from the original
 * multi-product VPAT template (Transparency = product index 1).
 *
 * Usage: npx tsx scripts/extract-weights.ts
 */
import { resolve } from 'path';
import { parseTemplate, extractQuestions } from '../src/docx/reader.js';

const TEMPLATE_PATH = resolve(import.meta.dirname, '../templates/H2 2024 ClearGov Overall ACR .docx');
const PRODUCT_INDEX = 1; // Transparency is the 2nd product

async function main() {
  const { products } = await parseTemplate(TEMPLATE_PATH);

  if (PRODUCT_INDEX >= products.length) {
    console.error(`Product index ${PRODUCT_INDEX} out of range (found ${products.length} products)`);
    process.exit(1);
  }

  const product = products[PRODUCT_INDEX];
  console.log(`Product: ${product.name}`);

  const questions = extractQuestions(product);

  const weightMap: Record<string, number> = {};
  for (const q of questions) {
    weightMap[q.questionText] = q.weight;
  }

  // Print summary
  const weights = questions.map((q) => q.weight);
  const distribution = new Map<number, number>();
  for (const w of weights) {
    distribution.set(w, (distribution.get(w) || 0) + 1);
  }

  console.log(`\nTotal questions: ${questions.length}`);
  console.log('Weight distribution:');
  for (const [w, count] of [...distribution.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Weight ${w}: ${count} questions`);
  }

  // Output full map as JSON
  console.log('\n--- Weight Map (JSON) ---');
  console.log(JSON.stringify(weightMap, null, 2));
}

main().catch(console.error);
