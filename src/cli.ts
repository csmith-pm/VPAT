import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadConfig } from './config.js';
import { scanUrls } from './scanner/axeRunner.js';
import { aggregateResults } from './scanner/resultAggregator.js';
import { scoreQuestions, scoringSummary } from './mapping/index.js';
import { parseTemplate } from './docx/reader.js';
import { generateDocx } from './docx/writer.js';

const program = new Command();

program
  .name('vpat-automation')
  .description('Automate VPAT/ACR accessibility scanning and document generation')
  .version('1.0.0')
  .option('-c, --config <path>', 'Config file path', './vpat.config.json')
  .option('--dry-run', 'Scan and show scores without generating .docx')
  .option('--scan-only', 'Save raw scan results as JSON')
  .option('--verbose', 'Detailed progress output')
  .option('--concurrency <n>', 'Parallel pages to scan', parseInt)
  .action(async (options) => {
    try {
      // Load config
      const configPath = resolve(options.config);
      const spinner = ora('Loading configuration...').start();
      const config = loadConfig(configPath);

      if (options.concurrency) {
        config.scanOptions.concurrency = options.concurrency;
      }

      spinner.succeed(`Configuration loaded: ${config.product} (${config.reportDate})`);
      console.log(chalk.dim(`  Template: ${config.templatePath}`));
      console.log(chalk.dim(`  URLs: ${config.urls.length}`));
      console.log(chalk.dim(`  Concurrency: ${config.scanOptions.concurrency}`));
      console.log();

      // Step 1: Scan URLs
      const scanSpinner = ora(`Scanning ${config.urls.length} URLs...`).start();
      const scanResults = await scanUrls(
        config.urls,
        config.scanOptions,
        (url, index, total) => {
          scanSpinner.text = `Scanning (${index + 1}/${total}): ${url}`;
        }
      );
      scanSpinner.succeed(`Scanned ${scanResults.length} URLs`);

      // Show scan summary
      const totalViolations = scanResults.reduce((sum, r) => sum + r.violations.length, 0);
      const totalPasses = scanResults.reduce((sum, r) => sum + r.passes.length, 0);
      const totalIncomplete = scanResults.reduce((sum, r) => sum + r.incomplete.length, 0);
      console.log(chalk.dim(`  Violations: ${totalViolations} | Passes: ${totalPasses} | Incomplete: ${totalIncomplete}`));
      console.log();

      // Save raw results if --scan-only
      if (options.scanOnly) {
        const outputPath = resolve('./output/scan-results.json');
        writeFileSync(outputPath, JSON.stringify(scanResults, null, 2));
        console.log(chalk.green(`Scan results saved to ${outputPath}`));
        return;
      }

      // Step 2: Aggregate results
      const aggSpinner = ora('Aggregating results by WCAG criterion...').start();
      const wcagResults = aggregateResults(scanResults);
      aggSpinner.succeed(`Aggregated results for ${wcagResults.size} WCAG success criteria`);

      if (options.verbose) {
        const aggTable = new Table({
          head: ['WCAG SC', 'Status', 'Violations', 'URLs Affected'],
          style: { head: ['cyan'] },
        });
        for (const [sc, result] of [...wcagResults.entries()].sort()) {
          const statusColor = result.status === 'pass' ? 'green' : result.status === 'fail' ? 'red' : 'yellow';
          aggTable.push([
            sc,
            chalk[statusColor](result.status),
            String(result.totalViolations),
            `${result.urlsWithViolations}/${result.totalUrls}`,
          ]);
        }
        console.log(aggTable.toString());
        console.log();
      }

      // Step 3: Parse template and score questions
      const templateSpinner = ora('Parsing DOCX template...').start();
      const { products, zip, parsedDoc } = await parseTemplate(resolve(config.templatePath));
      const product = products[config.productSectionIndex];
      if (!product) {
        templateSpinner.fail(`Product section index ${config.productSectionIndex} not found`);
        process.exit(1);
      }
      templateSpinner.succeed(`Parsed template: ${product.name}`);

      const scoreSpinner = ora('Scoring questions...').start();
      const scores = scoreQuestions(product, wcagResults);
      const summary = scoringSummary(scores);
      scoreSpinner.succeed('Questions scored');

      // Display summary
      const summaryTable = new Table({
        style: { head: ['cyan'] },
      });
      summaryTable.push(
        { 'Total Questions': String(summary.total) },
        { 'Automated': chalk.blue(String(summary.automated)) },
        { 'Manual Review': chalk.yellow(String(summary.manual)) },
        { 'Passing': chalk.green(String(summary.passing)) },
        { 'Failing': chalk.red(String(summary.failing)) },
        { 'N/A': chalk.dim(String(summary.na)) },
      );
      console.log(summaryTable.toString());
      console.log();

      if (options.verbose) {
        // Show detailed scores
        const detailTable = new Table({
          head: ['Question', 'Weight', 'Score', 'Auto', 'Comment'],
          style: { head: ['cyan'] },
          colWidths: [40, 8, 7, 6, 50],
          wordWrap: true,
        });
        for (const s of scores) {
          const scoreStr = s.score === null ? '*' : String(s.score);
          const scoreColor = s.score === 1 ? 'green' : s.score === 0 ? 'red' : 'dim';
          detailTable.push([
            s.questionText.substring(0, 38),
            String(s.weight),
            chalk[scoreColor](scoreStr),
            s.automatable ? 'Y' : 'N',
            s.comment.substring(0, 48),
          ]);
        }
        console.log(detailTable.toString());
        console.log();
      }

      // Step 4: Generate output document
      if (options.dryRun) {
        console.log(chalk.yellow('Dry run — skipping .docx generation'));
        return;
      }

      const docxSpinner = ora('Generating output document...').start();
      const outputPath = resolve(config.outputPath);
      await generateDocx(zip, parsedDoc, product, scores, config.reportDate, outputPath);
      docxSpinner.succeed(`Output saved to ${outputPath}`);
      console.log();
      console.log(chalk.green('Done! Remember to manually review non-automatable questions (marked with *).'));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      if (options.verbose && error instanceof Error) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
