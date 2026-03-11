# VPAT Automation - Getting Started

This guide walks you through setting up and running the VPAT automation tool to generate Accessibility Conformance Reports (ACRs) for ClearGov products.

## Prerequisites

- **Node.js 18+** — [Download here](https://nodejs.org/)
- **pnpm** — Install with `npm install -g pnpm`

## 1. Clone and Install

```bash
git clone <repo-url>
cd vpat-automation
pnpm install
```

This installs all dependencies including Playwright (browser automation) and axe-core (accessibility scanning).

## 2. Verify Setup

```bash
pnpm scan --help
```

You should see the available CLI options listed.

## 3. Understand the Config Files

Each product has a JSON config in `configs/`. Here's what one looks like:

```json
{
  "product": "ClearDocs",
  "reportDate": "Q1 2026",
  "templatePath": "./templates/ClearDocs-VPAT-Template.docx",
  "outputPath": "./output/Q1-2026-ClearDocs-ACR.docx",
  "productSectionIndex": 0,
  "urls": [
    "https://app.example.com/page1",
    "https://app.example.com/page2"
  ],
  "scanOptions": {
    "concurrency": 3,
    "timeout": 60000,
    "waitForSelector": "body"
  },
  "carryForwardPath": null
}
```

| Field | Description |
|---|---|
| `product` | Display name of the product |
| `reportDate` | Reporting period (e.g. "Q1 2026") |
| `templatePath` | Path to the DOCX template for this product |
| `outputPath` | Where to save the generated ACR |
| `productSectionIndex` | Which product section in the template to fill (0-based) |
| `urls` | All URLs to scan for accessibility issues |
| `scanOptions.concurrency` | How many pages to scan in parallel (1-10) |
| `scanOptions.timeout` | Page load timeout in milliseconds |
| `scanOptions.waitForSelector` | CSS selector to wait for before scanning |
| `carryForwardPath` | Path to a previous ACR to preserve manual scores (or `null`) |

Existing configs: `cleardocs.json`, `transparency.json`, `courbanize.json`.

## 4. Run a Scan

### Scan a single product

```bash
pnpm scan --config configs/cleardocs.json --verbose
```

### Scan all products

```bash
pnpm scan:all --verbose
```

### Preview without generating files

```bash
pnpm scan --config configs/cleardocs.json --dry-run
```

### Save raw axe-core results only

```bash
pnpm scan --config configs/cleardocs.json --scan-only
```

## 5. CLI Flags Reference

| Flag | Description |
|---|---|
| `-c, --config <path>` | Path to a product config file |
| `-a, --all` | Scan all products in `configs/` |
| `--dry-run` | Show scores without writing DOCX output |
| `--scan-only` | Save raw axe JSON results only |
| `--verbose` | Show detailed aggregation and scoring tables |
| `--concurrency <n>` | Override the config's concurrency setting |
| `--ai-review` | Use Claude AI to score manual-review questions (requires `ANTHROPIC_API_KEY`) |
| `--ai-confidence <n>` | Confidence threshold for AI scoring (0-1, default 0.7) |
| `--ai-model <model>` | Claude model to use for AI review |

## 6. Using AI Review (Optional)

Some VPAT questions can't be answered by automated scanning alone. The `--ai-review` flag uses Claude to help score these manual-review questions.

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
pnpm scan --config configs/cleardocs.json --ai-review
```

You can adjust the confidence threshold — questions scored below the threshold are left for manual review:

```bash
pnpm scan --config configs/cleardocs.json --ai-review --ai-confidence 0.8
```

## 7. Understanding the Output

After a scan completes, you'll find these files in `output/`:

| File | Description |
|---|---|
| `*-ACR-<timestamp>.docx` | The filled VPAT/ACR document with scores and comments |
| `*-ACR-<timestamp>-remediation.md` | Markdown report of all accessibility issues found |
| `*-ACR-<timestamp>-remediation-plan.docx` | Word doc version of the remediation report |

Timestamps are added automatically so successive runs don't overwrite each other.

### Console output summary

After scanning, you'll see a summary like:

```
Total Questions:  89
Automated:        67
Manual Review:    22
Passing:          56
Failing:          11
N/A:              22

Done! 22 question(s) still need manual review (marked with *).
```

Questions marked with `*` in the DOCX need a human to review and score manually.

## 8. How the Pipeline Works

The tool runs 4 steps in sequence:

1. **Scan** — Playwright opens each URL and runs axe-core to find accessibility violations
2. **Aggregate** — Results are rolled up by WCAG Success Criterion (e.g. 1.1.1, 2.1.1)
3. **Score** — Each question in the template is matched to WCAG criteria and scored (1 = supports, 0 = does not support, `*` = needs manual review)
4. **Write DOCX** — Scores and comments are injected into the template and saved as a new file

## 9. Adding a New Product

1. **Create a config file** at `configs/<product>.json` — copy an existing one and update the fields.

2. **Add a DOCX template** to `templates/`. Either:
   - Copy an existing template and rename it, or
   - Generate one with `pnpm create-template`

3. **Add the product's URLs** to the config's `urls` array. Include all pages you want scanned.

4. **Run a test scan** to verify:
   ```bash
   pnpm scan --config configs/<product>.json --dry-run --verbose
   ```

5. **Run the full scan** when ready:
   ```bash
   pnpm scan --config configs/<product>.json --verbose
   ```

## 10. Updating for a New Reporting Period

1. Update `reportDate` and `outputPath` in the product's config file.
2. Optionally set `carryForwardPath` to the previous ACR to preserve manual scores.
3. Update `urls` if pages have changed.
4. Run the scan.

## Troubleshooting

**Scan times out on a page**
Increase `scanOptions.timeout` in the config, or change `waitForSelector` to a selector that loads faster.

**Template parsing fails**
Verify `productSectionIndex` matches the template structure. Use `pnpm dump-template` to inspect template questions.

**"ANTHROPIC_API_KEY not set"**
This only matters if you're using `--ai-review`. Set the env var: `export ANTHROPIC_API_KEY="sk-ant-..."`

**Output looks wrong or has stale data**
Check the timestamp on the output file — you may be looking at an older run. Each run creates a new timestamped file.

## Running Tests

```bash
pnpm test          # run once
pnpm test:watch    # run in watch mode
```
