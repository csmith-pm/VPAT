/** Axe-core violation/pass/incomplete result for a single rule on a single URL */
export interface AxeRuleResult {
  ruleId: string;
  description: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  wcagTags: string[]; // e.g. ['wcag111', 'wcag2a']
  nodes: number; // count of affected nodes
}

/** Full scan result for a single URL */
export interface ScanResult {
  url: string;
  timestamp: string;
  violations: AxeRuleResult[];
  passes: AxeRuleResult[];
  incomplete: AxeRuleResult[];
}

/** Aggregated verdict for a single WCAG Success Criterion across all URLs */
export interface WcagScResult {
  /** e.g. "1.1.1" */
  sc: string;
  /** Overall verdict */
  status: 'pass' | 'fail' | 'incomplete';
  /** Total violations across all URLs */
  totalViolations: number;
  /** Number of URLs with violations */
  urlsWithViolations: number;
  /** Total URLs scanned */
  totalUrls: number;
  /** Top violation descriptions for comments */
  topIssues: string[];
}

/** Score for a single question in the VPAT template */
export interface QuestionScore {
  /** Row index in the table (0-based) */
  rowIndex: number;
  /** Table index in the document (0-based) */
  tableIndex: number;
  /** Question text from template */
  questionText: string;
  /** 1 = supports, 0 = does not support, null = N/A */
  score: number | null;
  /** Weight from template (1-3) */
  weight: number;
  /** weight * score, or null if N/A */
  weightedScore: number | null;
  /** Generated comment */
  comment: string;
  /** Whether this was auto-scored or needs manual review */
  automatable: boolean;
}

/** Parsed question row from the DOCX template */
export interface TemplateQuestion {
  tableIndex: number;
  rowIndex: number;
  questionText: string;
  weight: number;
  currentScore: string; // "1", "0", "*", or ""
  currentWeightedScore: string;
  currentComment: string;
  /** Which WCAG SC this maps to, e.g. "1.1.1" */
  wcagSc: string;
  /** Category: perceivable, operable, understandable, robust */
  category: string;
  /** Section header, e.g. "1.1: Non-Text Content" */
  section: string;
}

/** Row type in a WCAG table */
export type RowType = 'header' | 'section' | 'question' | 'subtotal' | 'empty';

/** Parsed row from a WCAG table */
export interface ParsedRow {
  rowIndex: number;
  type: RowType;
  cells: string[];
  /** For question rows */
  questionText?: string;
  weight?: number;
  score?: string;
  weightedScore?: string;
  comment?: string;
  /** For section rows */
  sectionName?: string;
}

/** Parsed WCAG category table */
export interface ParsedTable {
  tableIndex: number;
  category: 'perceivable' | 'operable' | 'understandable' | 'robust';
  rows: ParsedRow[];
}

/** Parsed product section from the template */
export interface ParsedProduct {
  name: string;
  productIndex: number;
  standardsTableIndex: number;
  tables: ParsedTable[];
}

/** Configuration for a scan run */
export interface VpatConfig {
  product: string;
  reportDate: string;
  templatePath: string;
  outputPath: string;
  productSectionIndex: number;
  urls: string[];
  scanOptions: {
    concurrency: number;
    timeout: number;
    waitForSelector: string;
  };
  carryForwardPath: string | null;
}

/** Entry in axe-to-wcag.json mapping */
export interface AxeToWcagEntry {
  ruleId: string;
  description: string;
  wcagScs: string[]; // e.g. ["1.1.1", "1.3.1"]
  tags: string[];
}

/** Entry in wcag-to-questions.json mapping */
export interface WcagToQuestionEntry {
  wcagSc: string;
  sectionName: string;
  questions: {
    questionText: string;
    rowIndices: Record<string, number>; // category table name → row index
    axeRules: string[];
    automatable: boolean;
    weight?: number;
  }[];
}
