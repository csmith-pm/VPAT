/**
 * Generate axe-to-wcag.json mapping file from axe-core rule metadata.
 *
 * Usage: npx tsx scripts/generate-axe-mapping.ts
 */
import axe from 'axe-core';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { AxeToWcagEntry } from '../src/types.js';

function parseWcagTag(tag: string): string | null {
  const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
  if (!match) return null;
  return `${match[1]}.${match[2]}.${match[3]}`;
}

const rules = axe.getRules();
const mapping: AxeToWcagEntry[] = [];

for (const rule of rules) {
  const wcagTags = (rule.tags || []).filter((t: string) => /^wcag\d{3,}$/.test(t));
  const wcagScs = wcagTags
    .map(parseWcagTag)
    .filter((sc): sc is string => sc !== null);

  if (wcagScs.length === 0) continue;

  mapping.push({
    ruleId: rule.ruleId,
    description: rule.description,
    wcagScs: [...new Set(wcagScs)],
    tags: rule.tags,
  });
}

// Sort by rule ID
mapping.sort((a, b) => a.ruleId.localeCompare(b.ruleId));

const outputPath = resolve(import.meta.dirname, '../mappings/axe-to-wcag.json');
writeFileSync(outputPath, JSON.stringify(mapping, null, 2));

console.log(`Generated ${mapping.length} axe rule → WCAG SC mappings`);
console.log(`Output: ${outputPath}`);

// Print summary
const scCounts = new Map<string, number>();
for (const entry of mapping) {
  for (const sc of entry.wcagScs) {
    scCounts.set(sc, (scCounts.get(sc) || 0) + 1);
  }
}
console.log(`\nWCAG SCs covered: ${scCounts.size}`);
for (const [sc, count] of [...scCounts.entries()].sort()) {
  console.log(`  ${sc}: ${count} rule(s)`);
}
