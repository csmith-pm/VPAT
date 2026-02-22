Run the full VPAT automation process: scan URLs with axe-core, score against WCAG criteria, and generate the output Word document.

## Steps

1. List available configs in `configs/` and ask the user which product(s) to scan, or whether to run all with `--all`.

2. Run the scan pipeline using the appropriate bash command:
   ```
   # Single product:
   cd /Users/csmith/vpat-automation && pnpm scan --config configs/<product>.json --verbose

   # All products:
   cd /Users/csmith/vpat-automation && pnpm scan:all --verbose
   ```

3. After the command completes, report the results:
   - Whether the scan succeeded or failed
   - Number of URLs scanned
   - Key scoring summary (total questions, automated, manual, passing, failing)
   - The output file paths for the generated Word document and remediation report
   - Remind the user to manually review questions marked with `*` (non-automatable)

4. If the scan fails, show the error output and suggest possible fixes (e.g., check that Playwright browsers are installed with `pnpm exec playwright install chromium`, verify URLs are accessible, check template file exists).
