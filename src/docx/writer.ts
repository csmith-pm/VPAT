import JSZip from 'jszip';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  parseXml,
  buildXml,
  findElements,
  getChildren,
  setCellText,
  getCellText,
} from './xmlHelpers.js';
import type { QuestionScore, ParsedProduct } from '../types.js';

/** Update a WCAG table with new scores and comments */
function updateTable(
  tableNode: any,
  scores: QuestionScore[],
  tableIndex: number
): void {
  const trNodes = getChildren(tableNode, 'w:tbl').filter((c: any) => 'w:tr' in c);

  // Build a map of rowIndex → score for this table
  const scoreMap = new Map<number, QuestionScore>();
  for (const s of scores) {
    if (s.tableIndex === tableIndex) {
      scoreMap.set(s.rowIndex, s);
    }
  }

  // Track subtotal values
  let totalWeightedScore = 0;
  let totalMaxScore = 0;

  for (let rowIdx = 0; rowIdx < trNodes.length; rowIdx++) {
    const score = scoreMap.get(rowIdx);
    if (!score) continue;

    const trNode = trNodes[rowIdx];
    const tcNodes = getChildren(trNode, 'w:tr').filter((c: any) => 'w:tc' in c);

    // Cell layout: [Question(span=4), Weight, Score, WeightedScore, Comments(span=4)]
    // Physical cells: typically 5 (but may be more due to fragmented comment spans)

    // Cell indices: 0=Question, 1=Weight, 2=Score, 3=WeightedScore, 4+=Comments
    if (tcNodes.length >= 4) {
      // Update Score (cell 2)
      const scoreText = score.score === null ? '*' : String(score.score);
      setCellText(tcNodes[2], scoreText);

      // Update Weighted Score (cell 3)
      const wsText = score.weightedScore === null ? '' : String(score.weightedScore);
      setCellText(tcNodes[3], wsText);

      // Update Comments (cell 4, or merge all remaining cells)
      if (tcNodes.length >= 5 && score.comment) {
        setCellText(tcNodes[4], score.comment);
        // Clear extra comment cells if they exist (fragmented spans)
        for (let i = 5; i < tcNodes.length; i++) {
          setCellText(tcNodes[i], '');
        }
      }
    }

    // Track for subtotals
    if (score.weightedScore !== null) {
      totalWeightedScore += score.weightedScore;
    }
    if (score.score !== null) {
      totalMaxScore += score.weight;
    }
  }

  // Update subtotal row if present
  const lastRow = trNodes[trNodes.length - 1];
  if (lastRow) {
    const lastCells = getChildren(lastRow, 'w:tr').filter((c: any) => 'w:tc' in c);
    const firstCellText = getCellText(lastCells[0]).trim().toLowerCase();
    if (firstCellText.includes('category subtotal')) {
      // Update the weighted score sum in the appropriate cell
      // The subtotal row has 11 cells (each spanning 1 column)
      // We need to put totals in the right columns
      if (lastCells.length >= 7) {
        // Column 6 (0-indexed) is typically the weighted score total
        setCellText(lastCells[6], String(totalWeightedScore));
        setCellText(lastCells[5], String(totalMaxScore));
      }
    }
  }
}

/** Update the report date in heading paragraphs */
function updateReportDate(parsedDoc: any[], reportDate: string): void {
  // Find paragraphs containing "Report Date:" and update the date
  const paragraphs = findElements(parsedDoc, 'w:p');
  for (const p of paragraphs) {
    const pChildren = getChildren(p, 'w:p');
    const text = pChildren
      .filter((c: any) => 'w:r' in c)
      .map((r: any) => getCellText({ 'w:tc': getChildren(r, 'w:r') }))
      .join('');

    if (text.includes('Report Date:')) {
      // Find the run containing the date value and update it
      const runs = pChildren.filter((c: any) => 'w:r' in c);
      // Usually the date is in the last run or after "Report Date:"
      for (const run of runs) {
        const runText = getCellText({ 'w:tc': getChildren(run, 'w:r') });
        if (runText.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) || runText.includes('Q')) {
          setCellText({ 'w:tc': getChildren(run, 'w:r') }, reportDate);
          break;
        }
      }
    }
  }
}

export async function generateDocx(
  zip: JSZip,
  parsedDoc: any[],
  product: ParsedProduct,
  scores: QuestionScore[],
  reportDate: string,
  outputPath: string
): Promise<void> {
  // Find all tables in the document body
  const body = findElements(parsedDoc, 'w:body');
  const bodyChildren = getChildren(body[0], 'w:body');

  const tables: { index: number; node: any }[] = [];
  let tableIdx = 0;
  for (const child of bodyChildren) {
    if ('w:tbl' in child) {
      tables.push({ index: tableIdx, node: child });
      tableIdx++;
    }
  }

  // Update each WCAG table for this product
  for (const table of product.tables) {
    const docTable = tables.find((t) => t.index === table.tableIndex);
    if (docTable) {
      updateTable(docTable.node, scores, table.tableIndex);
    }
  }

  // Update report date
  updateReportDate(parsedDoc, reportDate);

  // Rebuild XML and write back
  const newXml = buildXml(parsedDoc);
  zip.file('word/document.xml', newXml);

  // Generate output
  const outputBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, outputBuffer);
}
