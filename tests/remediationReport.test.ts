import { describe, it, expect } from 'vitest';
import {
  escapeMarkdown,
  escapeHtml,
  wcagScFromTag,
  buildRemediationIssues,
  generateRemediationMarkdown,
} from '../src/scanner/remediationReport.js';
import type { DetailedScanResult } from '../src/types.js';

describe('escapeMarkdown', () => {
  it('escapes pipe characters', () => {
    expect(escapeMarkdown('a | b')).toBe('a \\| b');
  });

  it('replaces newlines with spaces', () => {
    expect(escapeMarkdown('line1\nline2')).toBe('line1 line2');
  });

  it('returns plain text unchanged', () => {
    expect(escapeMarkdown('hello world')).toBe('hello world');
  });
});

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes pipe characters', () => {
    expect(escapeHtml('a | b')).toBe('a \\| b');
  });

  it('replaces newlines with spaces', () => {
    expect(escapeHtml('a\nb')).toBe('a b');
  });

  it('handles combined HTML and pipe escaping', () => {
    expect(escapeHtml('<span>a | b</span>')).toBe('&lt;span&gt;a \\| b&lt;/span&gt;');
  });
});

describe('wcagScFromTag', () => {
  it('extracts 1.1.1 from wcag111', () => {
    expect(wcagScFromTag('wcag111')).toBe('1.1.1');
  });

  it('extracts 1.4.11 from wcag1411', () => {
    expect(wcagScFromTag('wcag1411')).toBe('1.4.11');
  });

  it('extracts 2.1.1 from wcag211', () => {
    expect(wcagScFromTag('wcag211')).toBe('2.1.1');
  });

  it('returns null for non-WCAG tags', () => {
    expect(wcagScFromTag('best-practice')).toBeNull();
  });

  it('returns null for level tags like wcag2a', () => {
    expect(wcagScFromTag('wcag2a')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(wcagScFromTag('')).toBeNull();
  });
});

describe('buildRemediationIssues', () => {
  const makeResult = (
    url: string,
    violations: {
      ruleId: string;
      impact: 'minor' | 'moderate' | 'serious' | 'critical';
      wcagTags?: string[];
      nodes?: { target: string[]; html: string; failureSummary: string }[];
    }[]
  ): DetailedScanResult => ({
    url,
    timestamp: '2025-01-01T00:00:00Z',
    violations: [],
    passes: [],
    incomplete: [],
    violationDetails: violations.map((v) => ({
      ruleId: v.ruleId,
      description: `${v.ruleId} description`,
      impact: v.impact,
      wcagTags: v.wcagTags ?? ['wcag111'],
      help: `${v.ruleId} help`,
      helpUrl: `https://dequeuniversity.com/rules/${v.ruleId}`,
      nodeDetails: v.nodes ?? [
        { target: ['#el'], html: '<div id="el"></div>', failureSummary: 'Fix this' },
      ],
    })),
  });

  it('groups violations by ruleId across URLs', () => {
    const results = [
      makeResult('https://example.com/1', [{ ruleId: 'image-alt', impact: 'serious' }]),
      makeResult('https://example.com/2', [{ ruleId: 'image-alt', impact: 'serious' }]),
    ];

    const issues = buildRemediationIssues(results);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('image-alt');
    expect(issues[0].occurrences).toHaveLength(2);
    expect(issues[0].totalNodes).toBe(2);
  });

  it('sorts by impact severity (critical first)', () => {
    const results = [
      makeResult('https://example.com', [
        { ruleId: 'minor-rule', impact: 'minor' },
        { ruleId: 'critical-rule', impact: 'critical' },
        { ruleId: 'serious-rule', impact: 'serious' },
      ]),
    ];

    const issues = buildRemediationIssues(results);
    expect(issues.map((i) => i.impact)).toEqual(['critical', 'serious', 'minor']);
  });

  it('skips violations with no nodes', () => {
    const results = [
      makeResult('https://example.com', [
        { ruleId: 'no-nodes', impact: 'serious', nodes: [] },
        { ruleId: 'has-nodes', impact: 'serious' },
      ]),
    ];

    const issues = buildRemediationIssues(results);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleId).toBe('has-nodes');
  });

  it('returns empty array for empty input', () => {
    expect(buildRemediationIssues([])).toEqual([]);
  });

  it('counts total nodes across occurrences', () => {
    const results = [
      makeResult('https://example.com', [
        {
          ruleId: 'color-contrast',
          impact: 'serious',
          nodes: [
            { target: ['#a'], html: '<p>', failureSummary: 'Fix color' },
            { target: ['#b'], html: '<span>', failureSummary: 'Fix color' },
          ],
        },
      ]),
    ];

    const issues = buildRemediationIssues(results);
    expect(issues[0].totalNodes).toBe(2);
  });
});

describe('generateRemediationMarkdown', () => {
  it('produces header with product name and date', () => {
    const md = generateRemediationMarkdown([], 'MyProduct', '2025-01-01');
    expect(md).toContain('# Remediation Report: MyProduct');
    expect(md).toContain('**Date:** 2025-01-01');
  });

  it('outputs "No violations found." for empty issues', () => {
    const md = generateRemediationMarkdown([], 'MyProduct', '2025-01-01');
    expect(md).toContain('No violations found.');
  });

  it('includes impact section headings and issue details', () => {
    const issues = [
      {
        ruleId: 'image-alt',
        description: 'Images must have alt text',
        impact: 'critical' as const,
        wcagTags: ['wcag111'],
        help: 'Images must have alt text',
        helpUrl: 'https://dequeuniversity.com/rules/image-alt',
        occurrences: [
          {
            url: 'https://example.com',
            nodes: [{ target: ['img'], html: '<img src="x">', failureSummary: 'Add alt' }],
          },
        ],
        totalNodes: 1,
      },
    ];

    const md = generateRemediationMarkdown(issues, 'Test', '2025-01-01');
    expect(md).toContain('## Critical Issues');
    expect(md).toContain('**image-alt**');
    expect(md).toContain('**WCAG:** 1.1.1');
    expect(md).toContain('https://example.com');
  });

  it('shows best-practice label when no WCAG tags match', () => {
    const issues = [
      {
        ruleId: 'some-rule',
        description: 'A rule',
        impact: 'minor' as const,
        wcagTags: ['best-practice'],
        help: 'Some help',
        helpUrl: 'https://example.com',
        occurrences: [],
        totalNodes: 0,
      },
    ];

    const md = generateRemediationMarkdown(issues, 'Test', '2025-01-01');
    expect(md).toContain('**WCAG:** best-practice');
  });

  it('includes summary table with impact counts', () => {
    const issues = [
      {
        ruleId: 'rule1',
        description: 'desc',
        impact: 'serious' as const,
        wcagTags: ['wcag111'],
        help: 'help',
        helpUrl: 'https://example.com',
        occurrences: [],
        totalNodes: 5,
      },
    ];

    const md = generateRemediationMarkdown(issues, 'Test', '2025-01-01');
    expect(md).toContain('| serious | 1 | 5 |');
  });
});
