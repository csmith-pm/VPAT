# VPAT Automation

Automated VPAT/ACR generation — scans URLs with axe-core, scores against WCAG criteria, populates DOCX templates.

## Key Commands

- `pnpm scan --config configs/<product>.json --verbose` — scan single product
- `pnpm scan:all --verbose` — scan all products
- `pnpm test` / `pnpm test:watch` — Vitest tests
- `--dry-run` skips DOCX write; `--scan-only` saves raw axe JSON

## Project Structure

- `src/cli.ts` — CLI entry point (Commander.js)
- `src/config.ts` — Zod-validated config loader
- `src/types.ts` — All shared TypeScript interfaces
- `src/scanner/` — axe scanning, result aggregation, remediation reports
- `src/mapping/` — WCAG-to-question mapping and scoring logic
- `src/docx/` — DOCX template parsing and writing (XML-based via JSZip + fast-xml-parser)
- `configs/` — Per-product JSON configs (cleardocs, transparency, courbanize)
- `mappings/` — Static curated data (`axe-to-wcag.json`, `wcag-to-questions.json`)
- `templates/` — Input DOCX templates per product
- `output/` — Generated ACR files
- `scripts/` — One-off utilities (template creation, mapping generation)
- `tests/` — Vitest unit tests

## Pipeline

4 sequential steps:

1. **Scan**: Playwright + axe-core → `DetailedScanResult[]`
2. **Aggregate**: Roll up to per-WCAG-SC verdicts (`Map<string, WcagScResult>`)
3. **Score**: Match questions via fuzzy text overlap, assign 1/0/null scores
4. **Write DOCX**: Mutate parsed XML, rebuild, save .docx + remediation .md

## Adding a New Product

1. Create `configs/<product>.json` (follow existing schema)
2. Copy a DOCX template to `templates/<Product>-VPAT-Template.docx`
3. Add product name to `defaultProductNames` array in `src/docx/reader.ts`

## Conventions

- TypeScript run directly via `tsx` — no compile step
- All types centralized in `src/types.ts`
- DOCX manipulation is XML-based (no Word automation needed)
- `wcag-to-questions.json` is the curated mapping brain — changes require manual review
- Template structure: every 5 tables = 1 product section (1 standards + 4 WCAG categories)
- Tests use Vitest, files in `tests/`
