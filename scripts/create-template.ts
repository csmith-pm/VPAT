/**
 * Generate a clean single-product VPAT template for Transparency.
 *
 * Reads question data from mappings/wcag-to-questions.json and builds a
 * properly formatted .docx with:
 *   1. Header metadata block
 *   2. Standards/Guidelines table
 *   3. Four WCAG category tables (Perceivable, Operable, Understandable, Robust)
 *
 * Usage: npx tsx scripts/create-template.ts
 */
import { readFileSync } from 'fs';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TableLayoutType,
} from 'docx';
import type { WcagToQuestionEntry } from '../src/types.js';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const MAPPING_PATH = resolve(import.meta.dirname, '../mappings/wcag-to-questions.json');
const OUTPUT_PATH = resolve(import.meta.dirname, '../templates/Transparency-VPAT-Template.docx');

const mapping: WcagToQuestionEntry[] = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'));

// Category → WCAG SC prefixes
const CATEGORIES: { name: string; label: string; scPrefixes: string[] }[] = [
  { name: 'perceivable', label: 'Perceivable', scPrefixes: ['1.1', '1.2', '1.3', '1.4'] },
  { name: 'operable', label: 'Operable', scPrefixes: ['2.1', '2.2', '2.3', '2.4', '2.5'] },
  { name: 'understandable', label: 'Understandable', scPrefixes: ['3.1', '3.2', '3.3'] },
  { name: 'robust', label: 'Robust', scPrefixes: ['4.1'] },
];

// Standards table data
const STANDARDS = [
  { standard: 'Web Content Accessibility Guidelines 2.0', included: 'Level A — Yes\nLevel AA — Yes\nLevel AAA — Yes' },
  { standard: 'Web Content Accessibility Guidelines 2.1', included: 'Level A — Yes\nLevel AA — Yes\nLevel AAA — Yes' },
  { standard: 'Web Content Accessibility Guidelines 2.2', included: 'Level A — Yes\nLevel AA — Yes\nLevel AAA — Yes' },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const THIN_BORDER = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: '000000',
};
const CELL_BORDERS = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

const HEADER_SHADING = {
  type: ShadingType.CLEAR,
  color: 'auto',
  fill: '4472C4',
};

const SECTION_SHADING = {
  type: ShadingType.CLEAR,
  color: 'auto',
  fill: 'D9E2F3',
};

// Column widths (percentage of 11 grid columns): Question(4) Weight(1) Score(1) Weighted(1) Comments(4)
const COL_WIDTHS_PCT = [36, 9, 9, 9, 37]; // percentages ≈ 100
const TOTAL_WIDTH_TWIPS = 9360; // ≈ 6.5 inches in twips
const COL_WIDTHS = COL_WIDTHS_PCT.map((p) => Math.round((p / 100) * TOTAL_WIDTH_TWIPS));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headerCell(text: string, width: number, colSpan?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    width: { size: width, type: WidthType.DXA },
    shading: HEADER_SHADING,
    borders: CELL_BORDERS,
    columnSpan: colSpan,
  });
}

function textCell(text: string, width: number, opts?: { bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 20, font: 'Calibri', bold: opts?.bold })],
        alignment: opts?.alignment ?? AlignmentType.LEFT,
      }),
    ],
    width: { size: width, type: WidthType.DXA },
    borders: CELL_BORDERS,
  });
}

function sectionRow(sectionName: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: sectionName, bold: true, size: 20, font: 'Calibri' })],
          }),
        ],
        width: { size: TOTAL_WIDTH_TWIPS, type: WidthType.DXA },
        shading: SECTION_SHADING,
        borders: CELL_BORDERS,
        columnSpan: 5,
      }),
    ],
  });
}

function questionRow(questionText: string, weight: number): TableRow {
  return new TableRow({
    children: [
      textCell(questionText, COL_WIDTHS[0]),
      textCell(String(weight), COL_WIDTHS[1], { alignment: AlignmentType.CENTER }),
      textCell('', COL_WIDTHS[2], { alignment: AlignmentType.CENTER }), // Score
      textCell('', COL_WIDTHS[3], { alignment: AlignmentType.CENTER }), // Weighted Score
      textCell('', COL_WIDTHS[4]), // Comments
    ],
  });
}

function subtotalRow(): TableRow {
  return new TableRow({
    children: [
      textCell('Category Subtotal', COL_WIDTHS[0], { bold: true }),
      textCell('', COL_WIDTHS[1], { alignment: AlignmentType.CENTER }),
      textCell('', COL_WIDTHS[2], { alignment: AlignmentType.CENTER }),
      textCell('', COL_WIDTHS[3], { alignment: AlignmentType.CENTER }),
      textCell('', COL_WIDTHS[4]),
    ],
  });
}

// ---------------------------------------------------------------------------
// Build WCAG category table
// ---------------------------------------------------------------------------

function buildCategoryTable(category: (typeof CATEGORIES)[number]): Table {
  const rows: TableRow[] = [];

  // Header row
  rows.push(
    new TableRow({
      children: [
        headerCell('Questions', COL_WIDTHS[0]),
        headerCell('Weight', COL_WIDTHS[1]),
        headerCell('Score', COL_WIDTHS[2]),
        headerCell('Weighted Score', COL_WIDTHS[3]),
        headerCell('Comments', COL_WIDTHS[4]),
      ],
    })
  );

  // Questions grouped by WCAG SC
  for (const scPrefix of category.scPrefixes) {
    const entry = mapping.find((e) => e.wcagSc === scPrefix);
    if (!entry) continue;

    // Section header row
    rows.push(sectionRow(entry.sectionName));

    // Question rows
    for (const q of entry.questions) {
      const weight = q.weight ?? 2;
      rows.push(questionRow(q.questionText, weight));
    }
  }

  // Subtotal row
  rows.push(subtotalRow());

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });
}

// ---------------------------------------------------------------------------
// Build Standards/Guidelines table
// ---------------------------------------------------------------------------

function buildStandardsTable(): Table {
  const headerRow = new TableRow({
    children: [
      headerCell('Standard / Guideline', Math.round(TOTAL_WIDTH_TWIPS * 0.5)),
      headerCell('Included In Report', Math.round(TOTAL_WIDTH_TWIPS * 0.5)),
    ],
  });

  const dataRows = STANDARDS.map(
    (s) =>
      new TableRow({
        children: [
          textCell(s.standard, Math.round(TOTAL_WIDTH_TWIPS * 0.5)),
          new TableCell({
            children: s.included.split('\n').map(
              (line) =>
                new Paragraph({
                  children: [new TextRun({ text: line, size: 20, font: 'Calibri' })],
                })
            ),
            width: { size: Math.round(TOTAL_WIDTH_TWIPS * 0.5), type: WidthType.DXA },
            borders: CELL_BORDERS,
          }),
        ],
      })
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });
}

// ---------------------------------------------------------------------------
// Build document
// ---------------------------------------------------------------------------

function buildDocument(): Document {
  const children: (Paragraph | Table)[] = [];

  // Header metadata
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'ClearGov Transparency', bold: true, size: 32, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Accessibility Conformance Report — WCAG Edition', size: 24, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Report Date: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: '[DATE]', size: 20, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Product Name: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: 'ClearGov Transparency', size: 20, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Product Description: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({
          text: 'ClearGov Transparency is a public-facing financial data visualization platform that helps municipalities present budgets, revenues, and expenditures to residents in an accessible, interactive format.',
          size: 20,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Contact Information: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: 'accessibility@cleargov.com', size: 20, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Evaluation Methods Used: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({
          text: 'Automated testing with axe-core; manual expert review; assistive technology testing.',
          size: 20,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Scoring: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: '1 = Supports, 0 = Does Not Support, * = Not Applicable / Requires Manual Review', size: 20, font: 'Calibri' }),
      ],
    }),
    new Paragraph({ children: [] }),

    // Standards/Guidelines section
    new Paragraph({
      children: [new TextRun({ text: 'Standards / Guidelines', bold: true, size: 28, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_2,
    }),
    buildStandardsTable(),
    new Paragraph({ children: [] }),
  );

  // WCAG category tables
  for (const category of CATEGORIES) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `WCAG — ${category.label}`, bold: true, size: 28, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_2,
      }),
      buildCategoryTable(category),
      new Paragraph({ children: [] })
    );
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Building Transparency VPAT template...');
  console.log(`Reading questions from: ${MAPPING_PATH}`);

  // Count questions per category
  for (const cat of CATEGORIES) {
    const count = cat.scPrefixes.reduce((sum, sc) => {
      const entry = mapping.find((e) => e.wcagSc === sc);
      return sum + (entry?.questions.length ?? 0);
    }, 0);
    console.log(`  ${cat.label}: ${count} questions`);
  }

  const doc = buildDocument();
  const buffer = await Packer.toBuffer(doc);

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, buffer);

  console.log(`\nTemplate written to: ${OUTPUT_PATH}`);
  console.log('Next steps:');
  console.log('  1. Open in Word to verify formatting');
  console.log('  2. Run: npx tsx scripts/dump-template-questions.ts templates/Transparency-VPAT-Template.docx');
  console.log('  3. Update vpat.config.json to point to the new template');
}

main().catch(console.error);
