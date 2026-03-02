import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  textsMatch,
  scoringSummary,
  findRelevantResults,
} from '../src/mapping/index.js';
import type { QuestionScore, WcagScResult } from '../src/types.js';

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  it('strips punctuation', () => {
    expect(normalizeText('hello, world!')).toBe('hello world');
  });

  it('collapses whitespace', () => {
    expect(normalizeText('hello   world')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('handles combined transformations', () => {
    expect(normalizeText('  Hello,  World!  How are you?  ')).toBe('hello  world  how are you');
  });
});

describe('textsMatch', () => {
  it('matches identical strings', () => {
    expect(textsMatch('hello world', 'hello world')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(textsMatch('Hello World', 'hello world')).toBe(true);
  });

  it('matches despite punctuation differences', () => {
    expect(textsMatch('Non-text content:', 'Non-text content')).toBe(true);
  });

  it('matches similar text with >70% word overlap', () => {
    expect(textsMatch(
      'Provide text alternatives for non-text content',
      'Provide text alternatives for all non-text content'
    )).toBe(true);
  });

  it('does not match completely different texts', () => {
    expect(textsMatch(
      'Provide text alternatives',
      'Keyboard navigation support'
    )).toBe(false);
  });

  it('handles empty strings', () => {
    expect(textsMatch('', '')).toBe(true);
  });
});

describe('scoringSummary', () => {
  const makeScore = (
    overrides: Partial<QuestionScore> = {}
  ): QuestionScore => ({
    rowIndex: 0,
    tableIndex: 0,
    questionText: 'Test question',
    score: 1,
    weight: 1,
    weightedScore: 1,
    comment: '',
    automatable: true,
    ...overrides,
  });

  it('counts total questions', () => {
    const scores = [makeScore(), makeScore(), makeScore()];
    expect(scoringSummary(scores).total).toBe(3);
  });

  it('counts automated vs manual', () => {
    const scores = [
      makeScore({ automatable: true }),
      makeScore({ automatable: true }),
      makeScore({ automatable: false }),
    ];
    const summary = scoringSummary(scores);
    expect(summary.automated).toBe(2);
    expect(summary.manual).toBe(1);
  });

  it('counts passing, failing, and N/A', () => {
    const scores = [
      makeScore({ score: 1 }),
      makeScore({ score: 1 }),
      makeScore({ score: 0 }),
      makeScore({ score: null, weightedScore: null }),
    ];
    const summary = scoringSummary(scores);
    expect(summary.passing).toBe(2);
    expect(summary.failing).toBe(1);
    expect(summary.na).toBe(1);
  });

  it('handles empty array', () => {
    const summary = scoringSummary([]);
    expect(summary).toEqual({
      total: 0,
      automated: 0,
      manual: 0,
      passing: 0,
      failing: 0,
      na: 0,
    });
  });
});

describe('findRelevantResults', () => {
  const makeWcagResult = (
    sc: string,
    status: 'pass' | 'fail' | 'incomplete' = 'pass'
  ): WcagScResult => ({
    sc,
    status,
    totalViolations: status === 'fail' ? 1 : 0,
    urlsWithViolations: status === 'fail' ? 1 : 0,
    totalUrls: 1,
    topIssues: [],
  });

  it('finds results matching SC prefix', () => {
    const wcagResults = new Map<string, WcagScResult>([
      ['1.1.1', makeWcagResult('1.1.1', 'fail')],
      ['1.2.1', makeWcagResult('1.2.1', 'pass')],
    ]);

    const results = findRelevantResults('1.1', [], wcagResults);
    expect(results).toHaveLength(1);
    expect(results[0].sc).toBe('1.1.1');
  });

  it('returns multiple sub-SC results', () => {
    const wcagResults = new Map<string, WcagScResult>([
      ['1.4.1', makeWcagResult('1.4.1')],
      ['1.4.3', makeWcagResult('1.4.3')],
      ['1.4.11', makeWcagResult('1.4.11')],
      ['2.1.1', makeWcagResult('2.1.1')],
    ]);

    const results = findRelevantResults('1.4', [], wcagResults);
    expect(results).toHaveLength(3);
  });

  it('returns empty for no matches', () => {
    const wcagResults = new Map<string, WcagScResult>([
      ['1.1.1', makeWcagResult('1.1.1')],
    ]);

    const results = findRelevantResults('3.1', [], wcagResults);
    expect(results).toHaveLength(0);
  });

  it('does not match partial prefix (1.1 should not match 1.11)', () => {
    const wcagResults = new Map<string, WcagScResult>([
      ['1.11.1', makeWcagResult('1.11.1')],
    ]);

    const results = findRelevantResults('1.1', [], wcagResults);
    expect(results).toHaveLength(0);
  });
});
