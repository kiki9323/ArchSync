import type { ComponentValidationResult } from '../schema/component-validation.js';
import type { KnowledgeSyncResult } from '../schema/knowledge-sync.js';

export type ReportFormat = 'text' | 'markdown';

/**
 * Validator/Sync 결과를 사람이 읽게만 표현한다.
 * pass/fail/unknown/missing을 다시 판단하지 않는다.
 */
export function renderValidationReport(
  result: ComponentValidationResult,
  format: ReportFormat = 'text',
): string {
  return format === 'markdown'
    ? renderValidationMarkdown(result)
    : renderValidationText(result);
}

export function renderSyncReport(
  result: KnowledgeSyncResult,
  format: ReportFormat = 'text',
): string {
  return format === 'markdown'
    ? renderSyncMarkdown(result)
    : renderSyncText(result);
}

function renderValidationText(result: ComponentValidationResult): string {
  const lines: string[] = ['ArchSync Check', ''];

  if (result.status === 'missing') {
    lines.push('Summary');
    lines.push(`- status: missing`);
    lines.push(`- component: ${result.component}`);
    lines.push(`- mode: ${result.mode}`);
    lines.push(`- passed: 0`);
    lines.push(`- failed: 0`);
    lines.push(`- unknown: 0`);
    lines.push(`- missing: 1`);
    lines.push('');
    lines.push('Missing');
    lines.push(`- reason: ${result.reason}`);
    lines.push(`- knowledge: ${result.provenance.knowledge}`);
    lines.push('- detail: Knowledge JSON이 없어 검사하지 못했습니다.');
    return lines.join('\n');
  }

  if (result.mode === 'static') {
    lines.push('Summary');
    lines.push(`- status: ${result.status}`);
    lines.push(`- mode: static`);
    lines.push(`- component: ${result.component}`);
    lines.push(`- files checked: ${result.summary.filesScanned}`);
    lines.push(`- components checked: 1`);
    lines.push(`- usages: ${result.summary.usages}`);
    lines.push(`- passed: ${result.summary.passed}`);
    lines.push(`- failed: ${result.summary.failed}`);
    lines.push(`- unknown: ${result.summary.unknown}`);
    lines.push(`- missing: 0`);
    lines.push(`- knowledge: ${result.knowledge}`);
    if (result.file) {
      lines.push(`- file: ${result.file}`);
    }

    if (result.violations.length > 0) {
      lines.push('');
      lines.push('Violations');
      for (const violation of result.violations) {
        lines.push(
          `- ${violation.file}:${violation.line} ${violation.component}.${violation.prop}`,
        );
        lines.push(`  received: ${violation.value}`);
        lines.push(`  allowed: ${violation.allowed.join(' | ') || '(none)'}`);
        lines.push(`  provenance.knowledge: ${result.knowledge}`);
      }
    }

    if (result.unknown.length > 0) {
      lines.push('');
      lines.push('Unknown');
      for (const item of result.unknown) {
        lines.push(
          `- ${item.file}:${item.line} ${item.component}.${item.prop}`,
        );
        lines.push(`  reason: ${item.reason}`);
      }
    }

    return lines.join('\n');
  }

  lines.push('Summary');
  lines.push(`- status: ${result.status}`);
  lines.push(`- mode: runtime`);
  lines.push(`- harness: ${result.harness}`);
  lines.push(`- component: ${result.component}`);
  lines.push(`- passed: ${result.summary.passed}`);
  lines.push(`- failed: ${result.summary.failed}`);
  lines.push(`- unknown: ${result.summary.unknown}`);
  lines.push(`- missing: 0`);
  lines.push(`- knowledge: ${result.knowledge}`);

  if (result.comparisons.length > 0) {
    lines.push('');
    lines.push('Runtime comparisons');
    for (const comparison of result.comparisons) {
      lines.push(
        `- ${comparison.prop} (${comparison.kind}): ${comparison.status}`,
      );
    }
  }

  if (result.skipped.length > 0) {
    lines.push('');
    lines.push('Skipped');
    for (const skipped of result.skipped) {
      lines.push(`- ${skipped.prop}: ${skipped.reason}`);
    }
  }

  return lines.join('\n');
}

function renderValidationMarkdown(result: ComponentValidationResult): string {
  const lines: string[] = ['# ArchSync Check', ''];

  if (result.status === 'missing') {
    lines.push('## Summary');
    lines.push('');
    lines.push('| metric | value |');
    lines.push('| --- | --- |');
    lines.push(`| status | missing |`);
    lines.push(`| component | ${result.component} |`);
    lines.push(`| mode | ${result.mode} |`);
    lines.push('| passed | 0 |');
    lines.push('| failed | 0 |');
    lines.push('| unknown | 0 |');
    lines.push('| missing | 1 |');
    lines.push('');
    lines.push('## Missing');
    lines.push('');
    lines.push(`- **reason:** ${result.reason}`);
    lines.push(`- **knowledge:** \`${result.provenance.knowledge}\``);
    lines.push('- Knowledge JSON이 없어 검사하지 못했습니다.');
    return `${lines.join('\n')}\n`;
  }

  if (result.mode === 'static') {
    lines.push('## Summary');
    lines.push('');
    lines.push('| metric | value |');
    lines.push('| --- | --- |');
    lines.push(`| status | ${result.status} |`);
    lines.push('| mode | static |');
    lines.push(`| component | ${result.component} |`);
    lines.push(`| files checked | ${result.summary.filesScanned} |`);
    lines.push('| components checked | 1 |');
    lines.push(`| usages | ${result.summary.usages} |`);
    lines.push(`| passed | ${result.summary.passed} |`);
    lines.push(`| failed | ${result.summary.failed} |`);
    lines.push(`| unknown | ${result.summary.unknown} |`);
    lines.push('| missing | 0 |');
    lines.push(`| knowledge | \`${result.knowledge}\` |`);
    if (result.file) {
      lines.push(`| file | \`${result.file}\` |`);
    }

    if (result.violations.length > 0) {
      lines.push('');
      lines.push('## Violations');
      lines.push('');
      for (const violation of result.violations) {
        lines.push(
          `- \`${violation.file}:${violation.line}\` **${violation.component}.${violation.prop}**`,
        );
        lines.push(`  - received: \`${violation.value}\``);
        lines.push(
          `  - allowed: \`${violation.allowed.join(' | ') || '(none)'}\``,
        );
        lines.push(`  - provenance.knowledge: \`${result.knowledge}\``);
      }
    }

    if (result.unknown.length > 0) {
      lines.push('');
      lines.push('## Unknown');
      lines.push('');
      for (const item of result.unknown) {
        lines.push(
          `- \`${item.file}:${item.line}\` **${item.component}.${item.prop}**`,
        );
        lines.push(`  - reason: ${item.reason}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }

  lines.push('## Summary');
  lines.push('');
  lines.push('| metric | value |');
  lines.push('| --- | --- |');
  lines.push(`| status | ${result.status} |`);
  lines.push('| mode | runtime |');
  lines.push(`| harness | ${result.harness} |`);
  lines.push(`| component | ${result.component} |`);
  lines.push(`| passed | ${result.summary.passed} |`);
  lines.push(`| failed | ${result.summary.failed} |`);
  lines.push(`| unknown | ${result.summary.unknown} |`);
  lines.push('| missing | 0 |');
  lines.push(`| knowledge | \`${result.knowledge}\` |`);

  if (result.comparisons.length > 0) {
    lines.push('');
    lines.push('## Runtime comparisons');
    lines.push('');
    for (const comparison of result.comparisons) {
      lines.push(
        `- **${comparison.prop}** (${comparison.kind}): ${comparison.status}`,
      );
    }
  }

  if (result.skipped.length > 0) {
    lines.push('');
    lines.push('## Skipped');
    lines.push('');
    for (const skipped of result.skipped) {
      lines.push(`- **${skipped.prop}:** ${skipped.reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function renderSyncText(result: KnowledgeSyncResult): string {
  const lines = [
    'ArchSync Sync',
    '',
    'Summary',
    `- mode: ${result.mode}`,
    `- discovered: ${result.summary.discovered}`,
    `- created: ${result.summary.created}`,
    `- updated: ${result.summary.updated}`,
    `- unchanged: ${result.summary.unchanged}`,
    `- deleted: ${result.summary.deleted}`,
    `- skipped: ${result.summary.skipped}`,
    `- failed: ${result.summary.failed}`,
    `- extracted: ${result.summary.extracted}`,
  ];

  const failed = result.components.filter(
    (component) => component.status === 'failed',
  );

  if (failed.length > 0) {
    lines.push('');
    lines.push('Failed');
    for (const component of failed) {
      lines.push(
        `- ${component.component} (${component.modulePath}): ${component.reason ?? 'unknown error'}`,
      );
    }
  }

  return lines.join('\n');
}

function renderSyncMarkdown(result: KnowledgeSyncResult): string {
  const lines = [
    '# ArchSync Sync',
    '',
    '## Summary',
    '',
    '| metric | value |',
    '| --- | --- |',
    `| mode | ${result.mode} |`,
    `| discovered | ${result.summary.discovered} |`,
    `| created | ${result.summary.created} |`,
    `| updated | ${result.summary.updated} |`,
    `| unchanged | ${result.summary.unchanged} |`,
    `| deleted | ${result.summary.deleted} |`,
    `| skipped | ${result.summary.skipped} |`,
    `| failed | ${result.summary.failed} |`,
    `| extracted | ${result.summary.extracted} |`,
  ];

  const failed = result.components.filter(
    (component) => component.status === 'failed',
  );

  if (failed.length > 0) {
    lines.push('');
    lines.push('## Failed');
    lines.push('');
    for (const component of failed) {
      lines.push(
        `- **${component.component}** (\`${component.modulePath}\`): ${component.reason ?? 'unknown error'}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}
