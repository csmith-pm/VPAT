import { describe, it, expect } from 'vitest';
import { parseWcagTag, aggregateResults } from '../src/scanner/resultAggregator.js';
import type { ScanResult } from '../src/types.js';

describe('parseWcagTag', () => {
  it('parses wcag111 to 1.1.1', () => {
    expect(parseWcagTag('wcag111')).toBe('1.1.1');
  });

  it('parses wcag1411 to 1.4.11', () => {
    expect(parseWcagTag('wcag1411')).toBe('1.4.11');
  });

  it('parses wcag211 to 2.1.1', () => {
    expect(parseWcagTag('wcag211')).toBe('2.1.1');
  });

  it('returns null for non-wcag tags', () => {
    expect(parseWcagTag('best-practice')).toBeNull();
    expect(parseWcagTag('wcag2a')).toBeNull();
    expect(parseWcagTag('cat')).toBeNull();
  });
});

describe('aggregateResults', () => {
  const makeScanResult = (
    url: string,
    violations: { ruleId: string; tags: string[]; desc: string }[] = [],
    passes: { ruleId: string; tags: string[] }[] = []
  ): ScanResult => ({
    url,
    timestamp: new Date().toISOString(),
    violations: violations.map((v) => ({
      ruleId: v.ruleId,
      description: v.desc,
      impact: 'serious',
      wcagTags: v.tags,
      nodes: 1,
    })),
    passes: passes.map((p) => ({
      ruleId: p.ruleId,
      description: '',
      impact: null,
      wcagTags: p.tags,
      nodes: 0,
    })),
    incomplete: [],
  });

  it('marks SC as pass when all URLs pass', () => {
    const results = [
      makeScanResult('https://example.com/1', [], [{ ruleId: 'image-alt', tags: ['wcag111'] }]),
      makeScanResult('https://example.com/2', [], [{ ruleId: 'image-alt', tags: ['wcag111'] }]),
    ];

    const aggregated = aggregateResults(results);
    const sc111 = aggregated.get('1.1.1');
    expect(sc111).toBeDefined();
    expect(sc111!.status).toBe('pass');
    expect(sc111!.totalViolations).toBe(0);
  });

  it('marks SC as fail when any URL has violations', () => {
    const results = [
      makeScanResult('https://example.com/1', [
        { ruleId: 'image-alt', tags: ['wcag111'], desc: 'Images must have alt text' },
      ]),
      makeScanResult('https://example.com/2', [], [{ ruleId: 'image-alt', tags: ['wcag111'] }]),
    ];

    const aggregated = aggregateResults(results);
    const sc111 = aggregated.get('1.1.1');
    expect(sc111).toBeDefined();
    expect(sc111!.status).toBe('fail');
    expect(sc111!.totalViolations).toBe(1);
    expect(sc111!.urlsWithViolations).toBe(1);
    expect(sc111!.topIssues).toContain('Images must have alt text');
  });

  it('aggregates multiple violations across URLs', () => {
    const results = [
      makeScanResult('https://example.com/1', [
        { ruleId: 'image-alt', tags: ['wcag111'], desc: 'Missing alt text' },
        { ruleId: 'input-image-alt', tags: ['wcag111'], desc: 'Input images need alt' },
      ]),
      makeScanResult('https://example.com/2', [
        { ruleId: 'image-alt', tags: ['wcag111'], desc: 'Missing alt text' },
      ]),
    ];

    const aggregated = aggregateResults(results);
    const sc111 = aggregated.get('1.1.1');
    expect(sc111!.totalViolations).toBe(3);
    expect(sc111!.urlsWithViolations).toBe(2);
  });

  it('handles empty results', () => {
    const aggregated = aggregateResults([]);
    expect(aggregated.size).toBe(0);
  });
});
