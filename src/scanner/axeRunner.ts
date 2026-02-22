import { chromium, type Browser, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import type { ScanResult, AxeRuleResult, DetailedScanResult, AxeViolationDetail } from '../types.js';

function extractRuleResults(results: any[]): AxeRuleResult[] {
  return results.map((r) => ({
    ruleId: r.id,
    description: r.description,
    impact: r.impact ?? null,
    wcagTags: (r.tags as string[]).filter(
      (t: string) => t.startsWith('wcag') || t.startsWith('best-practice')
    ),
    nodes: r.nodes?.length ?? 0,
  }));
}

function extractViolationDetails(violations: any[]): AxeViolationDetail[] {
  return violations.map((v) => ({
    ruleId: v.id,
    description: v.description,
    impact: v.impact ?? null,
    wcagTags: (v.tags as string[]).filter(
      (t: string) => t.startsWith('wcag') || t.startsWith('best-practice')
    ),
    help: v.help ?? '',
    helpUrl: v.helpUrl ?? '',
    nodeDetails: (v.nodes ?? []).map((n: any) => ({
      target: n.target ?? [],
      html: (n.html ?? '').substring(0, 300),
      failureSummary: n.failureSummary ?? '',
    })),
  }));
}

export async function scanUrl(
  page: Page,
  url: string,
  options: { timeout: number; waitForSelector: string }
): Promise<DetailedScanResult> {
  await page.goto(url, { waitUntil: 'networkidle', timeout: options.timeout });
  await page.waitForSelector(options.waitForSelector, { timeout: options.timeout });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  return {
    url,
    timestamp: new Date().toISOString(),
    violations: extractRuleResults(results.violations),
    passes: extractRuleResults(results.passes),
    incomplete: extractRuleResults(results.incomplete),
    violationDetails: extractViolationDetails(results.violations),
  };
}

export async function scanUrls(
  urls: string[],
  options: { concurrency: number; timeout: number; waitForSelector: string },
  onProgress?: (url: string, index: number, total: number) => void
): Promise<DetailedScanResult[]> {
  const browser = await chromium.launch({ headless: true });
  const results: DetailedScanResult[] = [];

  // Process in batches of `concurrency`
  for (let i = 0; i < urls.length; i += options.concurrency) {
    const batch = urls.slice(i, i + options.concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url, batchIdx) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
          onProgress?.(url, i + batchIdx, urls.length);
          return await scanUrl(page, url, options);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Failed to scan ${url}: ${message}`);
          return {
            url,
            timestamp: new Date().toISOString(),
            violations: [],
            passes: [],
            incomplete: [],
            violationDetails: [],
          } satisfies DetailedScanResult;
        } finally {
          await context.close();
        }
      })
    );
    results.push(...batchResults);
  }

  await browser.close();
  return results;
}
