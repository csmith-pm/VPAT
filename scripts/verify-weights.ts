import { resolve } from 'path';
import { parseTemplate, extractQuestions } from '../src/docx/reader.js';

async function main() {
  const { products } = await parseTemplate(resolve(import.meta.dirname, '../templates/Transparency-VPAT-Template.docx'));
  const qs = extractQuestions(products[0]);
  const dist: Record<number, number> = {};
  qs.forEach((q) => (dist[q.weight] = (dist[q.weight] || 0) + 1));
  console.log('New template weight distribution:', dist);
  console.log(`Total: ${qs.length} questions`);
}
main().catch(console.error);
