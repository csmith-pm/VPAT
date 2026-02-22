import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { writeFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import { loadConfig } from './config.js';
import { scanUrls } from './scanner/axeRunner.js';
import { buildRemediationIssues, generateRemediationMarkdown } from './scanner/remediationReport.js';
import { aggregateResults } from './scanner/resultAggregator.js';
import { scoreQuestions, scoringSummary } from './mapping/index.js';
import { parseTemplate } from './docx/reader.js';
import { generateDocx } from './docx/writer.js';
import type { VpatConfig } from './types.js';

interface CliOptions {
  config?: string;
  all?: boolean;
  dryRun?: boolean;
  scanOnly?: boolean;
  verbose?: boolean;
  concurrency?: number;
}

async function runProduct(config: VpatConfig, options: CliOptions): Promise<{ product: string; success: boolean; error?: string }> {
  const productName = config.product;

  if (options.concurrency) {
    config.scanOptions.concurrency = options.concurrency;
  }

  console.log(chalk.bold.underline(`\nProduct: ${productName} (${config.reportDate})`));
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

  // Generate remediation report
  const remediationIssues = buildRemediationIssues(scanResults);
  const remediationMd = generateRemediationMarkdown(remediationIssues, config.product, config.reportDate);
  const remediationPath = resolve(config.outputPath.replace(/\.docx$/i, '-remediation.md'));
  writeFileSync(remediationPath, remediationMd);
  console.log(chalk.green(`Remediation report saved to ${remediationPath}`));
  console.log();

  // Save raw results if --scan-only
  if (options.scanOnly) {
    const outputPath = resolve(`./output/${productName.toLowerCase()}-scan-results.json`);
    writeFileSync(outputPath, JSON.stringify(scanResults, null, 2));
    console.log(chalk.green(`Scan results saved to ${outputPath}`));
    return { product: productName, success: true };
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
    return { product: productName, success: false, error: `Product section index ${config.productSectionIndex} not found` };
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
    return { product: productName, success: true };
  }

  const docxSpinner = ora('Generating output document...').start();
  const outputPath = resolve(config.outputPath);
  await generateDocx(zip, parsedDoc, product, scores, config.reportDate, outputPath);
  docxSpinner.succeed(`Output saved to ${outputPath}`);
  console.log();
  console.log(chalk.green('Done! Remember to manually review non-automatable questions (marked with *).'));

  return { product: productName, success: true };
}

function listAvailableConfigs(): string[] {
  try {
    const configsDir = resolve('configs');
    return readdirSync(configsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => `configs/${f}`);
  } catch {
    return [];
  }
}

const program = new Command();

program
  .name('vpat-automation')
  .description('Automate VPAT/ACR accessibility scanning and document generation')
  .version('1.0.0')
  .option('-c, --config <path>', 'Config file path')
  .option('-a, --all', 'Scan all products in configs/ directory')
  .option('--dry-run', 'Scan and show scores without generating .docx')
  .option('--scan-only', 'Save raw scan results as JSON')
  .option('--verbose', 'Detailed progress output')
  .option('--concurrency <n>', 'Parallel pages to scan', parseInt)
  .action(async (options: CliOptions) => {
    try {
      if (!options.config && !options.all) {
        const available = listAvailableConfigs();
        console.error(chalk.red('Error: Please specify --config <path> or --all'));
        console.error();
        if (available.length > 0) {
          console.error(chalk.yellow('Available configs:'));
          for (const c of available) {
            console.error(chalk.dim(`  --config ${c}`));
          }
          console.error();
          console.error(chalk.yellow('Or run all products:'));
          console.error(chalk.dim('  --all'));
        } else {
          console.error(chalk.yellow('No config files found in configs/ directory.'));
          console.error(chalk.dim('Create a config file at configs/<product>.json'));
        }
        process.exit(1);
      }

      if (options.all) {
        const configFiles = listAvailableConfigs();
        if (configFiles.length === 0) {
          console.error(chalk.red('No config files found in configs/ directory.'));
          process.exit(1);
        }

        console.log(chalk.bold(`Running ${configFiles.length} product(s): ${configFiles.map(f => basename(f, '.json')).join(', ')}`));

        const results: { product: string; success: boolean; error?: string }[] = [];

        for (const configFile of configFiles) {
          try {
            const config = loadConfig(resolve(configFile));
            const result = await runProduct(config, options);
            results.push(result);
          } catch (error) {
            const name = basename(configFile, '.json');
            console.error(chalk.red(`\nError scanning ${name}: ${error instanceof Error ? error.message : String(error)}`));
            results.push({ product: name, success: false, error: error instanceof Error ? error.message : String(error) });
          }
        }

        // Print summary
        console.log(chalk.bold('\n=== Summary ==='));
        const summaryTable = new Table({
          head: ['Product', 'Status'],
          style: { head: ['cyan'] },
        });
        for (const r of results) {
          summaryTable.push([
            r.product,
            r.success ? chalk.green('OK') : chalk.red(`FAILED: ${r.error ?? 'unknown'}`),
          ]);
        }
        console.log(summaryTable.toString());

        const failed = results.filter(r => !r.success).length;
        if (failed > 0) {
          process.exit(1);
        }
      } else {
        const configPath = resolve(options.config!);
        const spinner = ora('Loading configuration...').start();
        const config = loadConfig(configPath);
        spinner.succeed(`Configuration loaded: ${config.product} (${config.reportDate})`);

        const result = await runProduct(config, options);
        if (!result.success) {
          process.exit(1);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      if (options.verbose && error instanceof Error) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
