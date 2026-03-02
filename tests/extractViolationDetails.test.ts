import { describe, it, expect } from 'vitest';
import { extractViolationDetails } from '../src/scanner/axeRunner.js';

describe('extractViolationDetails', () => {
  it('maps raw axe violation to AxeViolationDetail', () => {
    const violations = [
      {
        id: 'image-alt',
        description: 'Images must have alt text',
        impact: 'critical',
        tags: ['wcag111', 'wcag2a', 'best-practice'],
        help: 'Images must have alternative text',
        helpUrl: 'https://dequeuniversity.com/rules/image-alt',
        nodes: [
          {
            target: ['img.logo'],
            html: '<img src="logo.png">',
            failureSummary: 'Fix: add alt attribute',
          },
        ],
      },
    ];

    const result = extractViolationDetails(violations);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe('image-alt');
    expect(result[0].description).toBe('Images must have alt text');
    expect(result[0].impact).toBe('critical');
    expect(result[0].help).toBe('Images must have alternative text');
    expect(result[0].helpUrl).toBe('https://dequeuniversity.com/rules/image-alt');
  });

  it('filters wcag tags to only wcag* and best-practice', () => {
    const violations = [
      {
        id: 'rule1',
        description: 'desc',
        impact: 'serious',
        tags: ['wcag111', 'cat.semantics', 'best-practice', 'ACT'],
        help: '',
        helpUrl: '',
        nodes: [],
      },
    ];

    const result = extractViolationDetails(violations);
    expect(result[0].wcagTags).toEqual(['wcag111', 'best-practice']);
  });

  it('handles violations with multiple nodes', () => {
    const violations = [
      {
        id: 'color-contrast',
        description: 'Elements must have sufficient color contrast',
        impact: 'serious',
        tags: ['wcag143'],
        help: 'Fix contrast',
        helpUrl: 'https://example.com',
        nodes: [
          { target: ['#header'], html: '<h1>Title</h1>', failureSummary: 'Contrast ratio 2.5:1' },
          { target: ['#footer'], html: '<p>Footer</p>', failureSummary: 'Contrast ratio 3.0:1' },
          { target: ['.nav', 'a'], html: '<a>Link</a>', failureSummary: 'Contrast ratio 2.8:1' },
        ],
      },
    ];

    const result = extractViolationDetails(violations);
    expect(result[0].nodeDetails).toHaveLength(3);
    expect(result[0].nodeDetails[0].target).toEqual(['#header']);
    expect(result[0].nodeDetails[1].target).toEqual(['#footer']);
    expect(result[0].nodeDetails[2].target).toEqual(['.nav', 'a']);
  });

  it('preserves impact, html, target, failureSummary per node', () => {
    const violations = [
      {
        id: 'link-name',
        description: 'Links must have discernible text',
        impact: 'serious',
        tags: ['wcag412'],
        help: 'Add link text',
        helpUrl: 'https://example.com',
        nodes: [
          {
            target: ['a.empty'],
            html: '<a href="/page"></a>',
            failureSummary: 'Element does not have text',
          },
        ],
      },
    ];

    const result = extractViolationDetails(violations);
    const node = result[0].nodeDetails[0];
    expect(node.target).toEqual(['a.empty']);
    expect(node.html).toBe('<a href="/page"></a>');
    expect(node.failureSummary).toBe('Element does not have text');
  });

  it('handles empty violations array', () => {
    expect(extractViolationDetails([])).toEqual([]);
  });

  it('defaults missing fields gracefully', () => {
    const violations = [
      {
        id: 'some-rule',
        description: 'desc',
        tags: ['wcag111'],
        // impact, help, helpUrl, nodes all missing
      },
    ];

    const result = extractViolationDetails(violations);
    expect(result[0].impact).toBeNull();
    expect(result[0].help).toBe('');
    expect(result[0].helpUrl).toBe('');
    expect(result[0].nodeDetails).toEqual([]);
  });

  it('truncates HTML to 300 characters', () => {
    const longHtml = '<div>' + 'a'.repeat(400) + '</div>';
    const violations = [
      {
        id: 'rule1',
        description: 'desc',
        impact: 'minor',
        tags: ['wcag111'],
        help: '',
        helpUrl: '',
        nodes: [{ target: ['div'], html: longHtml, failureSummary: '' }],
      },
    ];

    const result = extractViolationDetails(violations);
    expect(result[0].nodeDetails[0].html.length).toBe(300);
  });
});
