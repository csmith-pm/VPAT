import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  trimValues: false,
  cdataPropName: '__cdata',
  commentPropName: '__comment',
};

const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  suppressEmptyNode: false,
  format: false,
};

export function parseXml(xml: string): any[] {
  const parser = new XMLParser(parserOptions);
  return parser.parse(xml);
}

export function buildXml(obj: any[]): string {
  const builder = new XMLBuilder(builderOptions);
  return builder.build(obj);
}

/** Recursively extract all text content from an XML node */
export function extractText(node: any): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && node !== null) {
    const parts: string[] = [];
    for (const key of Object.keys(node)) {
      if (key.startsWith('@_') || key === ':@') continue;
      parts.push(extractText(node[key]));
    }
    return parts.join('');
  }
  return '';
}

/** Find all elements with a given tag name in parsed XML (preserveOrder format) */
export function findElements(nodes: any[], tagName: string): any[] {
  const results: any[] = [];
  if (!Array.isArray(nodes)) return results;

  for (const node of nodes) {
    if (typeof node !== 'object' || node === null) continue;
    if (tagName in node) {
      results.push(node);
    }
    // Recurse into child arrays
    for (const key of Object.keys(node)) {
      if (key.startsWith('@_') || key === ':@') continue;
      const val = node[key];
      if (Array.isArray(val)) {
        results.push(...findElements(val, tagName));
      }
    }
  }
  return results;
}

/** Get child elements of a specific tag from a node's children */
export function getChildren(node: any, parentTag: string): any[] {
  if (!node || !node[parentTag]) return [];
  const children = node[parentTag];
  return Array.isArray(children) ? children : [children];
}

/** Extract text from all w:t elements within a node */
export function getTextFromRuns(nodes: any[]): string {
  const textElements = findElements(nodes, 'w:t');
  return textElements.map((te) => extractText(te['w:t'])).join('');
}

/** Get the gridSpan value from a table cell's properties */
export function getGridSpan(tcNode: any): number {
  const tcPr = findElements(getChildren(tcNode, 'w:tc'), 'w:tcPr');
  if (tcPr.length === 0) return 1;
  const gridSpanEl = findElements(getChildren(tcPr[0], 'w:tcPr'), 'w:gridSpan');
  if (gridSpanEl.length === 0) return 1;
  const attrs = gridSpanEl[0][':@'];
  if (!attrs) return 1;
  return parseInt(attrs['@_w:val'] || '1', 10);
}

/** Set or replace text in a cell, preserving the first run's formatting */
export function setCellText(tcNode: any, text: string): void {
  const children = getChildren(tcNode, 'w:tc');

  // Find the first paragraph (w:p)
  const paragraphs = children.filter((c: any) => 'w:p' in c);
  if (paragraphs.length === 0) return;

  const para = paragraphs[0];
  const paraChildren = getChildren(para, 'w:p');

  // Find first run (w:r)
  const runs = paraChildren.filter((c: any) => 'w:r' in c);
  if (runs.length === 0) {
    // Create a new run with just a w:t
    const newRun = { 'w:r': [{ 'w:t': [{ '#text': text }], ':@': { '@_xml:space': 'preserve' } }] };
    para['w:p'].push(newRun);
    return;
  }

  // Keep only the first run, remove the rest
  const firstRun = runs[0];
  const runChildren = getChildren(firstRun, 'w:r');

  // Find or create w:t element
  const textEls = runChildren.filter((c: any) => 'w:t' in c);
  if (textEls.length > 0) {
    // Replace text content
    textEls[0]['w:t'] = [{ '#text': text }];
    if (!textEls[0][':@']) {
      textEls[0][':@'] = {};
    }
    textEls[0][':@']['@_xml:space'] = 'preserve';
    // Remove extra text elements
    firstRun['w:r'] = runChildren.filter((c: any) => !('w:t' in c)).concat([textEls[0]]);
  } else {
    firstRun['w:r'].push({ 'w:t': [{ '#text': text }], ':@': { '@_xml:space': 'preserve' } });
  }

  // Remove extra runs (keep only first run and paragraph properties)
  para['w:p'] = paraChildren.filter((c: any) => !('w:r' in c)).concat([firstRun]);
}

/** Get cell text from a table cell node */
export function getCellText(tcNode: any): string {
  return getTextFromRuns(getChildren(tcNode, 'w:tc'));
}
