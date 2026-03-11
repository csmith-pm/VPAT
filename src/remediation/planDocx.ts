import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  TableLayoutType,
  convertInchesToTwip,
} from 'docx';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Colors
const BLUE = '1F4E79';
const LIGHT_BLUE = 'D6E4F0';
const DARK_GRAY = '333333';
const WHITE = 'FFFFFF';
const RED_TAG = 'C00000';
const AMBER_TAG = 'BF8F00';
const GREEN_TAG = '548235';

interface RemediationIssue {
  ruleId: string;
  description: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  wcagTags: string[];
  help: string;
  helpUrl: string;
  occurrences: { url: string; nodes: { target: string[]; html: string; failureSummary: string }[] }[];
  totalNodes: number;
}

// Helpers
function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, color: BLUE, bold: true })],
  });
}

function bodyText(runs: TextRun[], spacing?: { before?: number; after?: number }) {
  return new Paragraph({
    spacing: { before: spacing?.before ?? 60, after: spacing?.after ?? 60 },
    children: runs,
  });
}

function bold(text: string, opts?: { color?: string; size?: number }): TextRun {
  return new TextRun({ text, bold: true, font: 'Aptos', size: opts?.size ?? 22, color: opts?.color ?? DARK_GRAY });
}

function normal(text: string, opts?: { color?: string; size?: number; italics?: boolean }): TextRun {
  return new TextRun({ text, font: 'Aptos', size: opts?.size ?? 22, color: opts?.color ?? DARK_GRAY, italics: opts?.italics });
}

function mono(text: string): TextRun {
  return new TextRun({ text, font: 'Consolas', size: 20, color: '555555' });
}

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' },
} as const;

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.SOLID, color: BLUE },
    borders: thinBorder,
    children: [new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, bold: true, font: 'Aptos', size: 20, color: WHITE })],
    })],
  });
}

function dataCell(runs: TextRun[], width?: number, shading?: string): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: shading ? { type: ShadingType.SOLID, color: shading } : undefined,
    borders: thinBorder,
    children: [new Paragraph({
      spacing: { before: 40, after: 40 },
      children: runs,
    })],
  });
}

function labelValueTable(rows: [string, TextRun[]][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: rows.map(([label, valueRuns], i) => {
      const shade = i % 2 === 0 ? LIGHT_BLUE : undefined;
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 3200, type: WidthType.DXA },
            shading: shade ? { type: ShadingType.SOLID, color: shade } : undefined,
            borders: thinBorder,
            children: [new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [bold(label, { size: 20 })],
            })],
          }),
          new TableCell({
            shading: shade ? { type: ShadingType.SOLID, color: shade } : undefined,
            borders: thinBorder,
            children: [new Paragraph({
              spacing: { before: 40, after: 40 },
              children: valueRuns,
            })],
          }),
        ],
      });
    }),
  });
}

function bulletItem(runs: TextRun[]): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
    children: runs,
  });
}

function severityTag(severity: string): TextRun {
  const color = severity === 'Critical' ? RED_TAG : severity === 'Serious' ? AMBER_TAG : GREEN_TAG;
  return new TextRun({ text: severity, bold: true, font: 'Aptos', size: 20, color });
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [] });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function wcagScFromTag(tag: string): string | null {
  const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;
  return null;
}

/** Generate a remediation plan DOCX from scan issues */
export async function generateRemediationPlanDocx(
  issues: RemediationIssue[],
  config: { product: string; reportDate: string },
  outputPath: string
): Promise<void> {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const totalOccurrences = issues.reduce((sum, i) => sum + i.totalNodes, 0);
  const totalPages = new Set(issues.flatMap(i => i.occurrences.map(o => o.url))).size;

  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: config.product, font: 'Aptos', size: 44, bold: true, color: BLUE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: 'Accessibility Remediation Plan', font: 'Aptos', size: 32, color: BLUE })],
    })
  );

  // Header table
  children.push(labelValueTable([
    ['Product', [normal(config.product)]],
    ['Prepared by', [normal('ClearGov')]],
    ['Date', [normal(dateStr)]],
    ['Conformance Standard', [normal('WCAG 2.1 Level AA')]],
  ]));

  // Executive Summary
  children.push(heading('Executive Summary', HeadingLevel.HEADING_2));
  children.push(bodyText([
    normal(`An automated accessibility assessment of ${config.product} identified ${issues.length} distinct accessibility rules with a total of ${totalOccurrences} occurrences across ${totalPages} pages.`),
  ]));

  if (issues.length === 0) {
    children.push(bodyText([normal('No accessibility violations were found. The product appears to conform to WCAG 2.1 Level AA based on automated testing.')]));
  }

  // Findings Summary Table
  if (issues.length > 0) {
    children.push(heading('Findings Summary', HeadingLevel.HEADING_2));

    const findingsRows = issues.map((issue, i) => {
      const remId = `REM-${String(i + 1).padStart(3, '0')}`;
      const wcagScs = issue.wcagTags.map(wcagScFromTag).filter((sc): sc is string => sc !== null);
      const wcagLabel = wcagScs.length > 0 ? wcagScs.join(', ') : 'Best practice';
      const shade = i % 2 === 0 ? LIGHT_BLUE : undefined;
      const pagesAffected = new Set(issue.occurrences.map(o => o.url)).size;

      return new TableRow({
        children: [
          dataCell([bold(remId, { size: 20 })], 1100, shade),
          dataCell([normal(issue.help, { size: 20 })], 2800, shade),
          dataCell([normal(wcagLabel, { size: 20 })], 2400, shade),
          dataCell([severityTag(capitalize(issue.impact))], 1200, shade),
          dataCell([normal(String(issue.totalNodes), { size: 20 })], 900, shade),
          dataCell([normal(String(pagesAffected), { size: 20 })], 900, shade),
        ],
      });
    });

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            headerCell('ID', 1100),
            headerCell('Rule', 2800),
            headerCell('WCAG SC', 2400),
            headerCell('Severity', 1200),
            headerCell('Count', 900),
            headerCell('Pages', 900),
          ],
        }),
        ...findingsRows,
      ],
    }));

    // Detailed Remediation Items
    children.push(heading('Detailed Remediation Items', HeadingLevel.HEADING_2));

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const remId = `REM-${String(i + 1).padStart(3, '0')}`;
      const wcagScs = issue.wcagTags.map(wcagScFromTag).filter((sc): sc is string => sc !== null);
      const wcagLabel = wcagScs.length > 0 ? wcagScs.join(', ') : 'Best practice';
      const pagesAffected = new Set(issue.occurrences.map(o => o.url)).size;

      children.push(heading(`${remId}: ${issue.help}`, HeadingLevel.HEADING_3));

      children.push(labelValueTable([
        ['Severity', [severityTag(capitalize(issue.impact))]],
        ['WCAG Success Criterion', [normal(wcagLabel)]],
        ['Occurrences', [normal(String(issue.totalNodes))]],
        ['Affected Pages', [normal(String(pagesAffected))]],
      ]));

      children.push(spacer());
      children.push(bodyText([bold('Description: '), normal(issue.description)]));

      // Show sample affected elements
      const sampleNodes = issue.occurrences.flatMap(o => o.nodes).slice(0, 5);
      if (sampleNodes.length > 0) {
        children.push(bodyText([bold('Affected elements (sample):')]));
        for (const node of sampleNodes) {
          children.push(bulletItem([
            mono(node.target.join(' > ').substring(0, 80)),
          ]));
        }
      }

      // Help link info
      children.push(bodyText([
        bold('More info: '),
        normal(issue.helpUrl),
      ]));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Aptos', size: 22, color: DARK_GRAY },
        },
        heading1: {
          run: { font: 'Aptos', size: 36, bold: true, color: BLUE },
          paragraph: { spacing: { before: 480, after: 160 } },
        },
        heading2: {
          run: { font: 'Aptos', size: 28, bold: true, color: BLUE },
          paragraph: { spacing: { before: 360, after: 120 } },
        },
        heading3: {
          run: { font: 'Aptos', size: 24, bold: true, color: BLUE },
          paragraph: { spacing: { before: 280, after: 100 } },
        },
      },
    },
    numbering: {
      config: [{
        reference: 'bullet-list',
        levels: [{
          level: 0,
          format: 'bullet',
          text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.8),
            bottom: convertInchesToTwip(0.8),
            left: convertInchesToTwip(0.9),
            right: convertInchesToTwip(0.9),
          },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
}
