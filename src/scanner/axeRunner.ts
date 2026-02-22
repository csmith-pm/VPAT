import { chromium, type Browser, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import type { ScanResult, AxeRuleResult } from '../types.js';

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

export async function scanUrl(
  page: Page,
  url: string,
  options: { timeout: number; waitForSelector: string }
): Promise<ScanResult> {
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
  };
}

export async function scanUrls(
  urls: string[],
  options: { concurrency: number; timeout: number; waitForSelector: string },
  onProgress?: (url: string, index: number, total: number) => void
): Promise<ScanResult[]> {
  const browser = await chromium.launch({ headless: true });
  const results: ScanResult[] = [];

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
          } satisfies ScanResult;
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
