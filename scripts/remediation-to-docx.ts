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
} from "docx";
import { writeFileSync } from "fs";

// Colors
const BLUE = "1F4E79";
const LIGHT_BLUE = "D6E4F0";
const DARK_GRAY = "333333";
const WHITE = "FFFFFF";
const RED_TAG = "C00000";
const AMBER_TAG = "BF8F00";
const GREEN_TAG = "548235";

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
  return new TextRun({ text, bold: true, font: "Aptos", size: opts?.size ?? 22, color: opts?.color ?? DARK_GRAY });
}

function normal(text: string, opts?: { color?: string; size?: number; italics?: boolean }): TextRun {
  return new TextRun({ text, font: "Aptos", size: opts?.size ?? 22, color: opts?.color ?? DARK_GRAY, italics: opts?.italics });
}

function mono(text: string): TextRun {
  return new TextRun({ text, font: "Consolas", size: 20, color: "555555" });
}

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
} as const;

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.SOLID, color: BLUE },
    borders: thinBorder,
    children: [new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, bold: true, font: "Aptos", size: 20, color: WHITE })],
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

function numberedItem(text: string, num: number): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.25) },
    children: [bold(`${num}. `), normal(text)],
  });
}

function severityTag(severity: string): TextRun {
  const color = severity === "Critical" ? RED_TAG : severity === "Serious" ? AMBER_TAG : GREEN_TAG;
  return new TextRun({ text: severity, bold: true, font: "Aptos", size: 20, color });
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [] });
}

// ─── Build document ───

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Aptos", size: 22, color: DARK_GRAY },
      },
      heading1: {
        run: { font: "Aptos", size: 36, bold: true, color: BLUE },
        paragraph: { spacing: { before: 480, after: 160 } },
      },
      heading2: {
        run: { font: "Aptos", size: 28, bold: true, color: BLUE },
        paragraph: { spacing: { before: 360, after: 120 } },
      },
      heading3: {
        run: { font: "Aptos", size: 24, bold: true, color: BLUE },
        paragraph: { spacing: { before: 280, after: 100 } },
      },
    },
  },
  numbering: {
    config: [{
      reference: "bullet-list",
      levels: [{
        level: 0,
        format: "bullet",
        text: "\u2022",
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
    children: [
      // ── Title ──
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "ClearDocs", font: "Aptos", size: 44, bold: true, color: BLUE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: "Accessibility Remediation Plan", font: "Aptos", size: 32, color: BLUE })],
      }),

      // ── Header table ──
      labelValueTable([
        ["Product", [normal("ClearDocs")]],
        ["Prepared by", [normal("ClearGov")]],
        ["Date", [normal("March 5, 2026")]],
        ["Conformance Standard", [normal("WCAG 2.1 Level AA")]],
        ["Regulatory Alignment", [normal("DOJ Title II ADA Final Rule (April 2024)")]],
        ["Target Completion", [normal("April 5, 2026")]],
      ]),

      // ── Executive Summary ──
      heading("Executive Summary", HeadingLevel.HEADING_2),

      bodyText([normal("ClearGov conducted an automated accessibility assessment of the ClearDocs product against WCAG 2.1 Level AA success criteria. The assessment identified four distinct accessibility rules with a total of 351 occurrences across 16 pages.")]),

      bodyText([normal("The majority of findings (343 of 351) relate to enhanced contrast (WCAG Level AAA), which exceeds the Level AA conformance target. The remaining 8 occurrences span three rules at Level AA \u2014 all of which are low in complexity and confined to a small number of components.")]),

      bodyText([normal("ClearGov is committed to resolving all Level AA issues within the timeline outlined below, ensuring ClearDocs meets the WCAG 2.1 AA standard required by the DOJ Title II ADA final rule ahead of the April 2026 compliance deadline. Enhanced contrast improvements (Level AAA) are documented as aspirational goals for future releases.")]),

      // ── Regulatory Context ──
      heading("Regulatory Context", HeadingLevel.HEADING_2),

      bodyText([normal("The U.S. Department of Justice published a final rule under Title II of the Americans with Disabilities Act (ADA) in April 2024, requiring state and local government web content and mobile applications to conform to "), bold("WCAG 2.1 Level AA"), normal(". The rule establishes two compliance deadlines based on entity size:")]),

      bulletItem([bold("Large entities"), normal(" (population 50,000+): "), bold("April 24, 2026")]),
      bulletItem([bold("Small entities"), normal(" (population under 50,000): April 26, 2027")]),

      bodyText([normal("Because ClearGov\u2019s customers are state and local governments, their use of ClearDocs falls squarely within the scope of this rule. ClearDocs is evaluated against WCAG 2.1 Level AA, directly aligning with the regulatory standard.")]),

      bodyText([normal("All three committed remediation items (REM-001 through REM-003) are scheduled for resolution by "), bold("March 19, 2026"), normal(" \u2014 more than five weeks ahead of the April 24, 2026 deadline for large entities. REM-004 (enhanced AAA contrast) exceeds the regulatory requirement and is not mandated by the Title II rule.")]),

      // ── Scope ──
      heading("Scope of Assessment", HeadingLevel.HEADING_2),

      bulletItem([bold("Pages tested: "), normal("16 URLs within the ClearDocs application ("), mono("city-heroville-nd-cleardoc.cleargov.com"), normal(")")]),
      bulletItem([bold("Methodology: "), normal("Automated scanning using axe-core 4.11 via Playwright")]),
      bulletItem([bold("Standards evaluated: "), normal("WCAG 2.1 Level AA (with Level AAA observations)")]),
      bulletItem([bold("Date of scan: "), normal("March 6, 2026")]),

      // ── Findings Summary ──
      heading("Findings Summary", HeadingLevel.HEADING_2),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell("ID", 1100),
              headerCell("Rule", 2600),
              headerCell("WCAG SC", 2400),
              headerCell("Severity", 1200),
              headerCell("Count", 900),
              headerCell("Pages", 900),
              headerCell("Target", 1700),
            ],
          }),
          ...[
            ["REM-001", "Missing image alt text", "1.1.1 Non-text Content", "Critical", "2", "2", "Mar 12, 2026"],
            ["REM-002", "Unlabeled form elements", "4.1.2 Name, Role, Value", "Critical", "2", "1", "Mar 12, 2026"],
            ["REM-003", "Min. color contrast (AA)", "1.4.3 Contrast (Minimum)", "Serious", "4", "4", "Mar 19, 2026"],
            ["REM-004", "Enhanced contrast (AAA)", "1.4.6 Contrast (Enhanced)", "Serious", "343", "16", "Aspirational"],
          ].map((row, i) => {
            const shade = i % 2 === 0 ? LIGHT_BLUE : undefined;
            return new TableRow({
              children: [
                dataCell([bold(row[0], { size: 20 })], 1100, shade),
                dataCell([normal(row[1], { size: 20 })], 2600, shade),
                dataCell([normal(row[2], { size: 20 })], 2400, shade),
                dataCell([severityTag(row[3])], 1200, shade),
                dataCell([normal(row[4], { size: 20 })], 900, shade),
                dataCell([normal(row[5], { size: 20 })], 900, shade),
                dataCell([normal(row[6], { size: 20 })], 1700, shade),
              ],
            });
          }),
        ],
      }),

      // ── Detailed Items ──
      heading("Detailed Remediation Items", HeadingLevel.HEADING_2),

      // REM-001
      heading("REM-001: Missing Image Alt Text", HeadingLevel.HEADING_3),

      labelValueTable([
        ["Severity", [severityTag("Critical")]],
        ["WCAG Success Criterion", [normal("1.1.1 Non-text Content (Level A)")]],
        ["Occurrences", [normal("2")]],
        ["Affected Pages", [normal("2")]],
        ["Target", [bold("Week 1 \u2014 by March 12, 2026")]],
      ]),

      spacer(),
      bodyText([bold("Description: "), normal("Two <img> elements are rendered without alt attributes, making their content inaccessible to screen readers and other assistive technologies.")]),

      bodyText([bold("Affected components:")]),
      numberedItem("An inline document image on the budget document page (2908\u00D71614 PNG)", 1),
      numberedItem("A Mapbox static map image on the CIP Project Request page", 2),

      bodyText([bold("Root cause: "), normal("These image elements are rendered without alt attributes in the template markup.")]),

      bodyText([bold("Remediation approach:")]),
      bulletItem([normal("Add descriptive alt text to all informational images conveying meaningful content")]),
      bulletItem([normal("For decorative images, apply "), mono('alt=""'), normal(" along with "), mono('role="presentation"'), normal(" to exclude them from the accessibility tree")]),
      bulletItem([normal("For the Mapbox map image, provide alt text describing the mapped location (e.g., "), mono('alt="Map showing project location"'), normal(")")]),

      // REM-002
      heading("REM-002: Unlabeled Form Elements", HeadingLevel.HEADING_3),

      labelValueTable([
        ["Severity", [severityTag("Critical")]],
        ["WCAG Success Criterion", [normal("4.1.2 Name, Role, Value (Level A)")]],
        ["Occurrences", [normal("2")]],
        ["Affected Pages", [normal("1")]],
        ["Target", [bold("Week 1 \u2014 by March 12, 2026")]],
      ]),

      spacer(),
      bodyText([bold("Description: "), normal("Two hidden <textarea> elements within the spreadsheet component lack accessible labels, causing assistive technology to present them without context.")]),

      bodyText([bold("Affected components:")]),
      numberedItem("textarea[gcuielement=\"gcSheetClipboard\"] \u2014 clipboard handler for spreadsheet copy/paste", 1),
      numberedItem("textarea[gcuielement=\"gcSheetFocusInput\"] \u2014 focus management input for spreadsheet interaction", 2),

      bodyText([bold("Root cause: "), normal("The GrapeCity SpreadJS component renders programmatic textarea elements for clipboard and focus management without accessible names.")]),

      bodyText([bold("Remediation approach:")]),
      bulletItem([normal("Add "), mono("aria-label"), normal(" attributes to both textarea elements (e.g., "), mono('aria-label="Spreadsheet clipboard"'), normal(" and "), mono('aria-label="Spreadsheet input"'), normal(")")]),
      bulletItem([normal("If these elements are purely programmatic and not intended for direct user interaction, alternatively apply "), mono('aria-hidden="true"'), normal(" and "), mono('tabindex="-1"'), normal(" to remove them from the accessibility tree entirely")]),

      // REM-003
      heading("REM-003: Minimum Color Contrast (AA)", HeadingLevel.HEADING_3),

      labelValueTable([
        ["Severity", [severityTag("Serious")]],
        ["WCAG Success Criterion", [normal("1.4.3 Contrast (Minimum) (Level AA)")]],
        ["Occurrences", [normal("4")]],
        ["Affected Pages", [normal("4")]],
        ["Target", [bold("Week 2 \u2014 by March 19, 2026")]],
      ]),

      spacer(),
      bodyText([bold("Description: "), normal("The \u201CTranslate\u201D button text fails to meet the WCAG AA minimum contrast ratio of 4.5:1 for normal-sized text (12px / 9pt).")]),

      bodyText([bold("Affected component: "), mono('cg-button[icon="fa-solid fa-language"]'), normal(" \u2014 the Translate button present in the page toolbar.")]),

      bodyText([bold("Root cause: "), normal("The button\u2019s foreground text color ("), mono("#c6c6c6"), normal(") against the toolbar background ("), mono("#f6f6f6"), normal(") produces a contrast ratio of approximately 1.58:1, well below the required 4.5:1 minimum.")]),

      bodyText([bold("Remediation approach:")]),
      bulletItem([normal("Update the foreground text color of the Translate button to achieve at least a 4.5:1 contrast ratio against "), mono("#f6f6f6")]),
      bulletItem([normal("Recommended fix: change the text color to "), mono("#767676"), normal(" or darker, which achieves a 4.54:1 ratio on a "), mono("#f6f6f6"), normal(" background")]),
      bulletItem([normal("This is a single CSS token change in the cg-button component\u2019s plain variant styling, applying consistently across all affected pages")]),

      // REM-004
      heading("REM-004: Enhanced Color Contrast (AAA) \u2014 Aspirational", HeadingLevel.HEADING_3),

      labelValueTable([
        ["Severity", [severityTag("Serious")]],
        ["WCAG Success Criterion", [normal("1.4.6 Contrast (Enhanced) (Level AAA)")]],
        ["Occurrences", [normal("343")]],
        ["Affected Pages", [normal("16")]],
        ["Target", [normal("Future improvement (not committed in this plan)", { italics: true })]],
      ]),

      spacer(),
      bodyText([bold("Description: "), normal("343 elements across all 16 tested pages meet the WCAG AA contrast ratio of 4.5:1 but do not meet the stricter AAA threshold of 7:1. These elements are conformant at the Level AA target of this assessment.")]),

      bodyText([bold("Common color pairings affected:")]),
      bulletItem([normal("Navigation links: "), mono("#0463b7"), normal(" on "), mono("#f1f8ff"), normal(" (ratio ~5.64:1)")]),
      bulletItem([normal("Toolbar buttons: "), mono("#2f5cb6"), normal(" on "), mono("#f1f8ff"), normal(" (ratio ~5.89:1)")]),
      bulletItem([normal("Secondary text: "), mono("#595959"), normal(" on "), mono("#f1f8ff"), normal(" (ratio ~6.54:1)")]),
      bulletItem([normal("Footer text: "), mono("#6f6f6f"), normal(" on "), mono("#f1f8ff"), normal(" (ratio ~4.69:1)")]),

      bodyText([bold("Status: "), normal("These findings are documented for transparency. ClearGov will evaluate AAA-level contrast improvements as part of a future design system update. No timeline is committed for these changes in this remediation cycle.")]),

      // ── Timeline Summary ──
      heading("Timeline Summary", HeadingLevel.HEADING_2),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell("Week", 1100),
              headerCell("Dates", 2800),
              headerCell("Activities", 3200),
              headerCell("Items", 3700),
            ],
          }),
          ...[
            ["Week 1", "Mar 5 \u2013 Mar 12, 2026", "Critical fixes", "REM-001 (image alt text), REM-002 (form labels)"],
            ["Week 2", "Mar 12 \u2013 Mar 19, 2026", "AA contrast fix", "REM-003 (Translate button contrast)"],
            ["Week 3", "Mar 19 \u2013 Mar 26, 2026", "QA & verification", "Manual testing of all fixes"],
            ["Week 4", "Mar 26 \u2013 Apr 5, 2026", "Retest & ACR update", "Re-run axe-core scan, update ACR document"],
          ].map((row, i) => {
            const shade = i % 2 === 0 ? LIGHT_BLUE : undefined;
            return new TableRow({
              children: [
                dataCell([bold(row[0], { size: 20 })], 1100, shade),
                dataCell([normal(row[1], { size: 20 })], 2800, shade),
                dataCell([normal(row[2], { size: 20 })], 3200, shade),
                dataCell([normal(row[3], { size: 20 })], 3700, shade),
              ],
            });
          }),
        ],
      }),

      // ── Verification ──
      heading("Verification & Retesting", HeadingLevel.HEADING_2),

      bodyText([normal("Upon completion of remediation activities, ClearGov will:")]),

      numberedItem("Re-run the automated axe-core scan across all 16 pages to confirm that REM-001, REM-002, and REM-003 are fully resolved", 1),
      numberedItem("Perform manual verification of image alt text quality and form element labeling with screen reader testing (NVDA/VoiceOver)", 2),
      numberedItem("Update the Accessibility Conformance Report (ACR) to reflect the current conformance status", 3),
      numberedItem("Publish the updated ACR and provide it to stakeholders upon request", 4),

      // ── Contact ──
      heading("Contact", HeadingLevel.HEADING_2),

      bodyText([normal("For questions regarding this remediation plan or ClearDocs accessibility, please contact:")]),
      spacer(),
      bodyText([bold("Hari Pandian")]),
      bodyText([normal("hpandian@cleargov.com")]),
    ],
  }],
});

async function main() {
  const buffer = await Packer.toBuffer(doc);
  const outPath = "output/ClearDocs-Remediation-Plan-2026-03-05.docx";
  writeFileSync(outPath, buffer);
  console.log(`Written to ${outPath}`);
}

main();
