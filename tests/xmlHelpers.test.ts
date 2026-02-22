import { describe, it, expect } from 'vitest';
import { parseXml, buildXml, extractText, findElements, getTextFromRuns } from '../src/docx/xmlHelpers.js';

describe('parseXml and buildXml', () => {
  it('round-trips simple XML', () => {
    const xml = '<root><child attr="val">text</child></root>';
    const parsed = parseXml(xml);
    const rebuilt = buildXml(parsed);
    expect(rebuilt).toContain('text');
    expect(rebuilt).toContain('attr');
  });
});

describe('extractText', () => {
  it('extracts text from nested objects', () => {
    const node = { 'w:t': [{ '#text': 'Hello World' }] };
    expect(extractText(node)).toBe('Hello World');
  });

  it('handles strings directly', () => {
    expect(extractText('test')).toBe('test');
  });

  it('handles numbers', () => {
    expect(extractText(42)).toBe('42');
  });

  it('handles arrays', () => {
    expect(extractText(['a', 'b', 'c'])).toBe('abc');
  });

  it('skips attribute keys', () => {
    const node = { '@_attr': 'val', 'w:t': [{ '#text': 'text' }] };
    expect(extractText(node)).toBe('text');
  });
});

describe('findElements', () => {
  it('finds elements at any depth', () => {
    const xml = '<doc><p><r><t>hello</t></r></p><p><r><t>world</t></r></p></doc>';
    const parsed = parseXml(xml);
    const found = findElements(parsed, 't');
    expect(found.length).toBe(2);
  });
});
