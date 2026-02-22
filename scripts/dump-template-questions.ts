/**
 * Extract all questions from the VPAT template and generate a skeleton
 * wcag-to-questions.json mapping file for manual curation.
 *
 * Usage: npx tsx scripts/dump-template-questions.ts [template-path]
 */
import { resolve } from 'path';
import { writeFileSync, existsSync } from 'fs';
import { parseTemplate, extractQuestions } from '../src/docx/reader.js';
import { loadAxeToWcagMapping } from '../src/mapping/wcagMapping.js';
import type { WcagToQuestionEntry } from '../src/types.js';

const templatePath = process.argv[2] || './templates/H2 2024 ClearGov Overall ACR .docx';

async function main() {
  console.log(`Parsing template: ${templatePath}`);
  const { products } = await parseTemplate(resolve(templatePath));

  // Use the first product as the reference (all 3 have identical question sets)
  const product = products[0];
  console.log(`Using product: ${product.name}`);

  const questions = extractQuestions(product);
  console.log(`Found ${questions.length} questions\n`);

  // Load axe mapping if available
  let axeMapping: Map<string, any> | null = null;
  try {
    axeMapping = loadAxeToWcagMapping();
    console.log(`Loaded axe-to-wcag mapping with ${axeMapping.size} rules`);
  } catch {
    console.log('No axe-to-wcag.json found — run generate-axe-mapping.ts first');
    console.log('Generating skeleton without axe rule suggestions\n');
  }

  // Group questions by WCAG SC section
  const grouped = new Map<string, typeof questions>();
  for (const q of questions) {
    const key = q.wcagSc || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(q);
  }

  // Build mapping entries
  const mapping: WcagToQuestionEntry[] = [];

  for (const [sc, scQuestions] of [...grouped.entries()].sort()) {
    // Find axe rules that map to this SC
    const relatedAxeRules: string[] = [];
    if (axeMapping) {
      for (const [ruleId, entry] of axeMapping) {
        if (entry.wcagScs.some((s: string) => s.startsWith(sc + '.') || s === sc)) {
          relatedAxeRules.push(ruleId);
        }
      }
    }

    const entry: WcagToQuestionEntry = {
      wcagSc: sc,
      sectionName: scQuestions[0].section,
      questions: scQuestions.map((q) => ({
        questionText: q.questionText,
        rowIndices: {
          [q.category]: q.rowIndex,
        },
        axeRules: relatedAxeRules, // User needs to curate which specific rules apply
        automatable: relatedAxeRules.length > 0,
      })),
    };

    mapping.push(entry);
  }

  // Write output
  const outputPath = resolve(import.meta.dirname, '../mappings/wcag-to-questions.json');
  writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
  console.log(`\nGenerated mapping skeleton: ${outputPath}`);
  console.log(`${mapping.length} WCAG sections, ${questions.length} questions total`);

  // Print summary
  const automatable = mapping.flatMap((m) => m.questions).filter((q) => q.automatable).length;
  const manual = mapping.flatMap((m) => m.questions).filter((q) => !q.automatable).length;
  console.log(`\nAutomatable: ${automatable} questions`);
  console.log(`Manual review: ${manual} questions`);
  console.log('\nNext step: Manually review and curate wcag-to-questions.json');
  console.log('  - Verify axeRules assignments per question');
  console.log('  - Set automatable: false for questions that need human judgment');

  // Also dump a readable summary
  const summaryPath = resolve(import.meta.dirname, '../mappings/template-questions-summary.txt');
  let summaryText = `VPAT Template Questions Summary\n${'='.repeat(60)}\n\n`;

  for (const [sc, scQuestions] of [...grouped.entries()].sort()) {
    summaryText += `\n${scQuestions[0].section}\n${'-'.repeat(40)}\n`;
    for (const q of scQuestions) {
      const marker = axeMapping && relatedRulesForSc(axeMapping, sc).length > 0 ? '[AUTO]' : '[MANUAL]';
      summaryText += `  ${marker} ${q.questionText}\n`;
      summaryText += `         Table: ${q.tableIndex}, Row: ${q.rowIndex}, Weight: ${q.weight}\n`;
    }
  }

  writeFileSync(summaryPath, summaryText);
  console.log(`\nReadable summary: ${summaryPath}`);
}

function relatedRulesForSc(axeMapping: Map<string, any>, sc: string): string[] {
  const rules: string[] = [];
  for (const [ruleId, entry] of axeMapping) {
    if (entry.wcagScs.some((s: string) => s.startsWith(sc + '.') || s === sc)) {
      rules.push(ruleId);
    }
  }
  return rules;
}

main().catch(console.error);
