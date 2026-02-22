Run the full VPAT automation process: scan URLs with axe-core, score against WCAG criteria, and generate the output Word document.

## Steps

1. Read the config file at `vpat.config.json` and display the product name, report date, URLs to scan, template path, and output path to confirm the run.

2. Run the scan pipeline using the following bash command:
   ```
   cd /Users/csmith/vpat-automation && pnpm scan --verbose
   ```

3. After the command completes, report the results:
   - Whether the scan succeeded or failed
   - Number of URLs scanned
   - Key scoring summary (total questions, automated, manual, passing, failing)
   - The output file path for the generated Word document
   - Remind the user to manually review questions marked with `*` (non-automatable)

4. If the scan fails, show the error output and suggest possible fixes (e.g., check that Playwright browsers are installed with `pnpm exec playwright install chromium`, verify URLs are accessible, check template file exists).
