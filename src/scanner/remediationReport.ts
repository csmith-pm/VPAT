import type { DetailedScanResult, AxeNodeDetail } from '../types.js';

interface RemediationOccurrence {
  url: string;
  nodes: AxeNodeDetail[];
}

interface RemediationIssue {
  ruleId: string;
  description: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  wcagTags: string[];
  help: string;
  helpUrl: string;
  occurrences: RemediationOccurrence[];
  totalNodes: number;
}

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

export function buildRemediationIssues(scanResults: DetailedScanResult[]): RemediationIssue[] {
  const issueMap = new Map<string, RemediationIssue>();

  for (const result of scanResults) {
    for (const violation of result.violationDetails) {
      if (!violation.impact || violation.nodeDetails.length === 0) continue;

      let issue = issueMap.get(violation.ruleId);
      if (!issue) {
        issue = {
          ruleId: violation.ruleId,
          description: violation.description,
          impact: violation.impact,
          wcagTags: violation.wcagTags,
          help: violation.help,
          helpUrl: violation.helpUrl,
          occurrences: [],
          totalNodes: 0,
        };
        issueMap.set(violation.ruleId, issue);
      }

      issue.occurrences.push({
        url: result.url,
        nodes: violation.nodeDetails,
      });
      issue.totalNodes += violation.nodeDetails.length;
    }
  }

  return [...issueMap.values()].sort(
    (a, b) => (IMPACT_ORDER[a.impact] ?? 4) - (IMPACT_ORDER[b.impact] ?? 4)
  );
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function escapeHtml(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
}

function wcagScFromTag(tag: string): string | null {
  const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;
  return null;
}

export function generateRemediationMarkdown(
  issues: RemediationIssue[],
  productName: string,
  reportDate: string
): string {
  const lines: string[] = [];

  lines.push(`# Remediation Report: ${productName}`);
  lines.push(`**Date:** ${reportDate}`);
  lines.push('');

  // Summary table by impact
  const impactGroups: Record<string, { rules: number; nodes: number }> = {};
  for (const issue of issues) {
    const group = impactGroups[issue.impact] ?? { rules: 0, nodes: 0 };
    group.rules++;
    group.nodes += issue.totalNodes;
    impactGroups[issue.impact] = group;
  }

  lines.push('## Summary');
  lines.push('');
  lines.push('| Impact | Rules | Occurrences |');
  lines.push('|--------|-------|-------------|');
  for (const level of ['critical', 'serious', 'moderate', 'minor']) {
    const group = impactGroups[level];
    if (group) {
      lines.push(`| ${level} | ${group.rules} | ${group.nodes} |`);
    }
  }
  lines.push('');

  if (issues.length === 0) {
    lines.push('No violations found.');
    return lines.join('\n');
  }

  // Group issues by impact for section headings
  let currentImpact = '';
  for (const issue of issues) {
    if (issue.impact !== currentImpact) {
      currentImpact = issue.impact;
      lines.push(`## ${currentImpact.charAt(0).toUpperCase() + currentImpact.slice(1)} Issues`);
      lines.push('');
    }

    const wcagScs = issue.wcagTags
      .map(wcagScFromTag)
      .filter((sc): sc is string => sc !== null);
    const wcagLabel = wcagScs.length > 0 ? wcagScs.join(', ') : 'best-practice';

    lines.push(`<details>`);
    lines.push(`<summary><strong>${issue.ruleId}</strong> — ${escapeMarkdown(issue.help)} (${issue.totalNodes} occurrences)</summary>`);
    lines.push('');
    lines.push(`- **Impact:** ${issue.impact}`);
    lines.push(`- **WCAG:** ${wcagLabel}`);
    lines.push(`- **Description:** ${escapeMarkdown(issue.description)}`);
    lines.push(`- **Help:** [${escapeMarkdown(issue.help)}](${issue.helpUrl})`);
    lines.push('');

    for (const occurrence of issue.occurrences) {
      lines.push(`### ${escapeMarkdown(occurrence.url)}`);
      lines.push('');
      lines.push('| Selector | HTML | Fix |');
      lines.push('|----------|------|-----|');
      for (const node of occurrence.nodes) {
        const selector = escapeMarkdown(node.target.join(' > '));
        const html = escapeHtml(node.html);
        const fix = escapeMarkdown(node.failureSummary);
        lines.push(`| \`${selector}\` | \`${html}\` | ${fix} |`);
      }
      lines.push('');
    }

    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n');
}
