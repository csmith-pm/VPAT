import { describe, it, expect } from 'vitest';
import {
  parseXml,
  getChildren,
  getTextFromRuns,
  getCellText,
  getGridSpan,
} from '../src/docx/xmlHelpers.js';

describe('getChildren', () => {
  it('returns child elements for a given parent tag', () => {
    const node = {
      'w:p': [
        { 'w:r': [{ 'w:t': [{ '#text': 'hello' }] }] },
        { 'w:r': [{ 'w:t': [{ '#text': 'world' }] }] },
      ],
    };
    const children = getChildren(node, 'w:p');
    expect(children).toHaveLength(2);
  });

  it('returns empty array when parent tag not found', () => {
    const node = { 'w:p': [{ 'w:r': [] }] };
    expect(getChildren(node, 'w:tc')).toEqual([]);
  });

  it('returns empty array for null/undefined node', () => {
    expect(getChildren(null, 'w:p')).toEqual([]);
    expect(getChildren(undefined, 'w:p')).toEqual([]);
  });

  it('wraps non-array value in array', () => {
    const node = { 'w:p': { 'w:r': [] } };
    const children = getChildren(node, 'w:p');
    expect(children).toHaveLength(1);
  });
});

describe('getTextFromRuns', () => {
  it('extracts text from w:r/w:t run nodes', () => {
    const nodes = [
      { 'w:r': [{ 'w:t': [{ '#text': 'Hello' }] }] },
      { 'w:r': [{ 'w:t': [{ '#text': ' World' }] }] },
    ];
    expect(getTextFromRuns(nodes)).toBe('Hello World');
  });

  it('returns empty string when no w:t elements found', () => {
    const nodes = [{ 'w:pPr': [{ 'w:jc': [] }] }];
    expect(getTextFromRuns(nodes)).toBe('');
  });

  it('handles empty nodes array', () => {
    expect(getTextFromRuns([])).toBe('');
  });

  it('concatenates text from nested runs', () => {
    const nodes = [
      {
        'w:r': [
          { 'w:rPr': [{ 'w:b': [] }] },
          { 'w:t': [{ '#text': 'Bold' }] },
        ],
      },
      { 'w:r': [{ 'w:t': [{ '#text': ' text' }] }] },
    ];
    expect(getTextFromRuns(nodes)).toBe('Bold text');
  });
});

describe('getCellText', () => {
  it('extracts text from a table cell node', () => {
    const tcNode = {
      'w:tc': [
        {
          'w:p': [
            { 'w:r': [{ 'w:t': [{ '#text': 'Cell content' }] }] },
          ],
        },
      ],
    };
    expect(getCellText(tcNode)).toBe('Cell content');
  });

  it('returns empty string for empty cell', () => {
    const tcNode = { 'w:tc': [{ 'w:p': [{ 'w:pPr': [] }] }] };
    expect(getCellText(tcNode)).toBe('');
  });

  it('concatenates text from multiple paragraphs', () => {
    const tcNode = {
      'w:tc': [
        { 'w:p': [{ 'w:r': [{ 'w:t': [{ '#text': 'Line 1' }] }] }] },
        { 'w:p': [{ 'w:r': [{ 'w:t': [{ '#text': 'Line 2' }] }] }] },
      ],
    };
    expect(getCellText(tcNode)).toBe('Line 1Line 2');
  });
});

describe('getGridSpan', () => {
  it('returns 1 when no grid span specified', () => {
    const tcNode = {
      'w:tc': [{ 'w:p': [{ 'w:r': [] }] }],
    };
    expect(getGridSpan(tcNode)).toBe(1);
  });

  it('reads grid span value from cell properties', () => {
    const tcNode = {
      'w:tc': [
        {
          'w:tcPr': [
            {
              'w:gridSpan': [],
              ':@': { '@_w:val': '3' },
            },
          ],
        },
        { 'w:p': [] },
      ],
    };
    expect(getGridSpan(tcNode)).toBe(3);
  });

  it('returns 1 when tcPr exists but no gridSpan', () => {
    const tcNode = {
      'w:tc': [
        {
          'w:tcPr': [
            { 'w:tcW': [], ':@': { '@_w:w': '5000' } },
          ],
        },
        { 'w:p': [] },
      ],
    };
    expect(getGridSpan(tcNode)).toBe(1);
  });
});
