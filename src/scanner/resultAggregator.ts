import type { ScanResult, WcagScResult } from '../types.js';

/** Extract WCAG SC numbers from axe-core tags like "wcag111" → "1.1.1" */
export function parseWcagTag(tag: string): string | null {
  // Match patterns like wcag111, wcag131, wcag211, wcag1411
  const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
  if (!match) return null;
  return `${match[1]}.${match[2]}.${match[3]}`;
}

/** Aggregate scan results across all URLs into per-WCAG-SC verdicts */
export function aggregateResults(scanResults: ScanResult[]): Map<string, WcagScResult> {
  const scMap = new Map<string, {
    violations: Map<string, string[]>; // url → descriptions
    passes: Set<string>;
    incomplete: Set<string>;
    allIssues: string[];
  }>();

  for (const result of scanResults) {
    // Process violations
    for (const v of result.violations) {
      for (const tag of v.wcagTags) {
        const sc = parseWcagTag(tag);
        if (!sc) continue;

        if (!scMap.has(sc)) {
          scMap.set(sc, { violations: new Map(), passes: new Set(), incomplete: new Set(), allIssues: [] });
        }
        const entry = scMap.get(sc)!;
        if (!entry.violations.has(result.url)) {
          entry.violations.set(result.url, []);
        }
        entry.violations.get(result.url)!.push(v.description);
        entry.allIssues.push(v.description);
      }
    }

    // Process passes
    for (const p of result.passes) {
      for (const tag of p.wcagTags) {
        const sc = parseWcagTag(tag);
        if (!sc) continue;

        if (!scMap.has(sc)) {
          scMap.set(sc, { violations: new Map(), passes: new Set(), incomplete: new Set(), allIssues: [] });
        }
        scMap.get(sc)!.passes.add(result.url);
      }
    }

    // Process incomplete
    for (const inc of result.incomplete) {
      for (const tag of inc.wcagTags) {
        const sc = parseWcagTag(tag);
        if (!sc) continue;

        if (!scMap.has(sc)) {
          scMap.set(sc, { violations: new Map(), passes: new Set(), incomplete: new Set(), allIssues: [] });
        }
        scMap.get(sc)!.incomplete.add(result.url);
      }
    }
  }

  // Build final results
  const results = new Map<string, WcagScResult>();
  for (const [sc, data] of scMap) {
    const totalViolations = Array.from(data.violations.values())
      .reduce((sum, descs) => sum + descs.length, 0);

    // Deduplicate issues for top descriptions
    const uniqueIssues = [...new Set(data.allIssues)];

    let status: 'pass' | 'fail' | 'incomplete';
    if (data.violations.size > 0) {
      status = 'fail';
    } else if (data.incomplete.size > 0) {
      status = 'incomplete';
    } else {
      status = 'pass';
    }

    results.set(sc, {
      sc,
      status,
      totalViolations,
      urlsWithViolations: data.violations.size,
      totalUrls: scanResults.length,
      topIssues: uniqueIssues.slice(0, 3),
    });
  }

  return results;
}
