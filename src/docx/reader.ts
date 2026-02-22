import JSZip from 'jszip';
import { readFileSync } from 'fs';
import {
  parseXml,
  findElements,
  getChildren,
  getCellText,
  getGridSpan,
} from './xmlHelpers.js';
import type { ParsedProduct, ParsedTable, ParsedRow, RowType } from '../types.js';

const CATEGORY_MAP: Record<number, 'perceivable' | 'operable' | 'understandable' | 'robust'> = {
  0: 'perceivable',
  1: 'operable',
  2: 'understandable',
  3: 'robust',
};

/** Determine row type from cell content */
function classifyRow(cells: string[], cellCount: number): RowType {
  const firstCell = cells[0]?.trim() || '';

  if (firstCell.toLowerCase() === 'questions') return 'header';
  if (firstCell.toLowerCase().includes('category subtotal')) return 'subtotal';
  if (/^\d+\.\d+:/.test(firstCell)) return 'section';
  if (firstCell === '' && cells.every((c) => c.trim() === '')) return 'empty';
  if (firstCell.length > 0) return 'question';

  return 'empty';
}

/** Parse a single WCAG table into structured rows */
function parseWcagTable(
  tableNode: any,
  tableIndex: number,
  categoryIndex: number
): ParsedTable {
  const rows: ParsedRow[] = [];
  const trNodes = getChildren(tableNode, 'w:tbl').filter((c: any) => 'w:tr' in c);

  for (let rowIdx = 0; rowIdx < trNodes.length; rowIdx++) {
    const trNode = trNodes[rowIdx];
    const tcNodes = getChildren(trNode, 'w:tr').filter((c: any) => 'w:tc' in c);

    const cells = tcNodes.map((tc: any) => getCellText(tc));
    const type = classifyRow(cells, tcNodes.length);

    const row: ParsedRow = {
      rowIndex: rowIdx,
      type,
      cells,
    };

    if (type === 'section') {
      row.sectionName = cells[0].trim();
    } else if (type === 'question') {
      row.questionText = cells[0]?.trim();
      // Cells: [Question(gridSpan=4), Weight, Score, WeightedScore, Comments(gridSpan=4)]
      // But physical cells may vary; Weight is typically cell[1], Score cell[2], etc.
      row.weight = parseInt(cells[1] || '0', 10) || 0;
      row.score = cells[2]?.trim() || '';
      row.weightedScore = cells[3]?.trim() || '';
      row.comment = cells.slice(4).join(' ').trim();
    }

    rows.push(row);
  }

  return {
    tableIndex,
    category: CATEGORY_MAP[categoryIndex] || 'perceivable',
    rows,
  };
}

/** Find product heading paragraphs and identify which tables belong to which product */
export async function parseTemplate(templatePath: string): Promise<{
  products: ParsedProduct[];
  zip: JSZip;
  documentXml: string;
  parsedDoc: any[];
}> {
  const buffer = readFileSync(templatePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')!.async('string');
  const parsedDoc = parseXml(documentXml);

  // Get the document body
  const body = findElements(parsedDoc, 'w:body');
  if (body.length === 0) throw new Error('No document body found');

  const bodyChildren = getChildren(body[0], 'w:body');

  // Find all tables and heading paragraphs
  const tables: { index: number; node: any; bodyIndex: number }[] = [];
  const headings: { text: string; bodyIndex: number; style: string }[] = [];
  let tableIdx = 0;

  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i];

    if ('w:tbl' in child) {
      tables.push({ index: tableIdx, node: child, bodyIndex: i });
      tableIdx++;
    } else if ('w:p' in child) {
      // Check for heading style
      const pPr = findElements(getChildren(child, 'w:p'), 'w:pPr');
      if (pPr.length > 0) {
        const pStyle = findElements(getChildren(pPr[0], 'w:pPr'), 'w:pStyle');
        if (pStyle.length > 0) {
          const style = pStyle[0][':@']?.['@_w:val'] || '';
          if (style.startsWith('Heading')) {
            const text = getCellText({ 'w:tc': getChildren(child, 'w:p') });
            headings.push({ text: text.trim(), bodyIndex: i, style });
          }
        }
      }
    }
  }

  // Auto-detect product count from table count.
  // Each product has 5 tables: 1 standards + 4 WCAG category tables.
  // e.g. 15 tables = 3 products, 5 tables = 1 product.
  const TABLES_PER_PRODUCT = 5;
  const productCount = Math.floor(tables.length / TABLES_PER_PRODUCT);
  if (productCount === 0) {
    throw new Error(`Expected at least ${TABLES_PER_PRODUCT} tables in template, found ${tables.length}`);
  }

  const products: ParsedProduct[] = [];

  // For multi-product templates, use known names; for single-product, derive from headings
  const defaultProductNames = ['ClearDocs', 'Transparency', 'ClearForms'];

  for (let p = 0; p < productCount; p++) {
    const baseTableIdx = p * TABLES_PER_PRODUCT;
    const wcagTables: ParsedTable[] = [];

    for (let c = 0; c < 4; c++) {
      const tblEntry = tables[baseTableIdx + 1 + c]; // skip standards table
      if (tblEntry) {
        wcagTables.push(parseWcagTable(tblEntry.node, tblEntry.index, c));
      }
    }

    // Determine product name
    const firstTableBodyIdx = tables[baseTableIdx]?.bodyIndex ?? 0;
    let productName = defaultProductNames[p] || `Product ${p + 1}`;

    if (productCount === 1) {
      // Single-product template: use the first Heading1 as the product name
      const h1 = headings.find((h) => h.style === 'Heading1');
      if (h1?.text) {
        productName = h1.text;
      }
    } else {
      // Multi-product: find closest heading before this product's tables
      const precedingHeadings = headings.filter((h) => h.bodyIndex < firstTableBodyIdx);
      if (precedingHeadings.length > 0) {
        const closest = precedingHeadings[precedingHeadings.length - 1];
        if (closest.text && !closest.text.toLowerCase().includes('standard')) {
          productName = closest.text;
        }
      }
    }

    products.push({
      name: productName,
      productIndex: p,
      standardsTableIndex: tables[baseTableIdx]?.index ?? -1,
      tables: wcagTables,
    });
  }

  return { products, zip, documentXml, parsedDoc };
}

/** Extract all questions from a product section for mapping purposes */
export function extractQuestions(product: ParsedProduct): TemplateQuestion[] {
  const questions: TemplateQuestion[] = [];
  let currentSection = '';

  for (const table of product.tables) {
    for (const row of table.rows) {
      if (row.type === 'section') {
        currentSection = row.sectionName || '';
      } else if (row.type === 'question') {
        // Extract WCAG SC from section name (e.g. "1.1: Non-Text Content" → SC prefix "1.1")
        const scMatch = currentSection.match(/^(\d+\.\d+):/);
        const scPrefix = scMatch ? scMatch[1] : '';

        questions.push({
          tableIndex: table.tableIndex,
          rowIndex: row.rowIndex,
          questionText: row.questionText || '',
          weight: row.weight || 0,
          currentScore: row.score || '',
          currentWeightedScore: row.weightedScore || '',
          currentComment: row.comment || '',
          wcagSc: scPrefix,
          category: table.category,
          section: currentSection,
        });
      }
    }
  }

  return questions;
}

import type { TemplateQuestion } from '../types.js';
