import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AxeToWcagEntry } from '../types.js';

let cachedMapping: Map<string, AxeToWcagEntry> | null = null;

/** Load the axe-to-wcag mapping from JSON */
export function loadAxeToWcagMapping(
  mappingPath: string = resolve(import.meta.dirname, '../../mappings/axe-to-wcag.json')
): Map<string, AxeToWcagEntry> {
  if (cachedMapping) return cachedMapping;

  if (!existsSync(mappingPath)) {
    throw new Error(
      `axe-to-wcag.json not found at ${mappingPath}. Run: npx tsx scripts/generate-axe-mapping.ts`
    );
  }

  const raw = JSON.parse(readFileSync(mappingPath, 'utf-8')) as AxeToWcagEntry[];
  cachedMapping = new Map(raw.map((e) => [e.ruleId, e]));
  return cachedMapping;
}

/** Get all WCAG SC numbers that a given axe rule maps to */
export function getWcagScsForRule(ruleId: string): string[] {
  const mapping = loadAxeToWcagMapping();
  return mapping.get(ruleId)?.wcagScs ?? [];
}

/** Get all axe rule IDs that map to a given WCAG SC */
export function getAxeRulesForSc(sc: string): string[] {
  const mapping = loadAxeToWcagMapping();
  const rules: string[] = [];
  for (const [ruleId, entry] of mapping) {
    if (entry.wcagScs.includes(sc)) {
      rules.push(ruleId);
    }
  }
  return rules;
}
