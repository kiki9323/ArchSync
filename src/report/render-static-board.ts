import type {
  StaticBoardQaLane,
  StaticBoardResult,
  StaticBoardRow,
  StaticBoardUncheckableReason,
} from '../validator/validate-all-project-usage.js';

export type StaticBoardFormat = 'text' | 'json' | 'markdown' | 'html';

const QA_LABEL: Record<StaticBoardQaLane, string> = {
  failed: '위반',
  'checked-pass': '유한값 통과',
  uncheckable: '판정 불가',
};

const UNCHECKABLE_LABEL: Record<StaticBoardUncheckableReason, string> = {
  'empty-contract': '빈 계약',
  'no-finite-values': '유한값 없음',
  unused: '미사용',
  'open-only': '열린 값만',
};

/**
 * 기존 check 결과를 사람이 보게만 표현한다.
 * Agent status를 바꾸지 않는다. QA 레인은 유한값 리터럴만 본다.
 */
export function renderStaticBoard(
  board: StaticBoardResult,
  format: StaticBoardFormat = 'html',
): string {
  if (format === 'json') {
    return JSON.stringify(board, null, 2);
  }

  if (format === 'markdown') {
    return renderMarkdown(board);
  }

  if (format === 'text') {
    return renderText(board);
  }

  return renderHtml(board);
}

function renderText(board: StaticBoardResult): string {
  const lines = [
    'ArchSync static board',
    '',
    `files scanned: ${board.summary.filesScanned}`,
    `components: ${board.summary.components}`,
    `qa failed: ${board.summary.failed}`,
    `qa checked-pass: ${board.summary.checkedPass} (literals ${board.summary.literalPassed})`,
    `qa uncheckable: ${board.summary.uncheckable}`,
    `agent passed: ${board.summary.passed}`,
    `unknown: ${board.summary.unknown}`,
    `empty contract: ${board.summary.emptyContract}`,
    `unused: ${board.summary.unused}`,
    '',
  ];

  for (const row of board.rows) {
    const reason = row.uncheckableReason ? ` ${row.uncheckableReason}` : '';
    lines.push(
      `- ${row.component}  ${row.qaLane}${reason}  agent=${row.status}  usages=${row.summary.usages} checked=${row.summary.checked} passed=${row.summary.passed} failed=${row.summary.failed} unknown=${row.summary.unknown}`,
    );
  }

  return lines.join('\n');
}

function renderMarkdown(board: StaticBoardResult): string {
  const lines = [
    '# ArchSync static board',
    '',
    'Knowledge SSOT가 아닙니다. 초록은 컴포넌트 전체가 깨끗하다는 뜻이 아니라, **검사 가능한 유한값 리터럴이 허용값 안**이었다는 뜻입니다.',
    '',
    '| 빨강 위반 | 초록 유한값 통과 | 회색 판정 불가 | 유한값 리터럴 통과 | 검사 못 함 |',
    '| --- | --- | --- | ---: | ---: |',
    `| ${board.summary.failed} | ${board.summary.checkedPass} | ${board.summary.uncheckable} | ${board.summary.literalPassed} | ${board.summary.unknown} |`,
    '',
    '| component | QA | agent status | usages | passed | failed | unknown | 계약 |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const row of board.rows) {
    lines.push(
      `| ${row.component} | ${QA_LABEL[row.qaLane]} | ${row.status} | ${row.summary.usages} | ${row.summary.passed} | ${row.summary.failed} | ${row.summary.unknown} | ${contractLabel(row)} |`,
    );
  }

  const failed = board.rows.filter((row) => row.violations.length > 0);

  if (failed.length > 0) {
    lines.push('', '## Violations');

    for (const row of failed) {
      for (const violation of row.violations) {
        lines.push(
          `- \`${violation.file}:${violation.line}\` ${violation.component}.${violation.prop} received \`${violation.value}\` allowed \`${violation.allowed.join(' | ') || '(none)'}\``,
        );
      }
    }
  }

  return lines.join('\n');
}

function renderHtml(board: StaticBoardResult): string {
  const rows = board.rows.map(renderHtmlRow).join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ArchSync static board</title>
  <style>
    :root {
      --bg: #0f1115;
      --panel: #171a21;
      --text: #e8eaed;
      --muted: #9aa3af;
      --line: #2a303a;
      --red-bg: #3a1c1a;
      --green-bg: #163024;
      --gray-bg: #1f232b;
    }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    main { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    .lede { color: var(--muted); margin: 0 0 24px; line-height: 1.5; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
    .chip {
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 0.875rem;
      border: 1px solid var(--line);
    }
    .chip.failed { background: var(--red-bg); color: #f3c0bc; }
    .chip.passed { background: var(--green-bg); color: #b7e0c6; }
    .chip.gray { background: var(--gray-bg); color: #d1d5db; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 0.875rem; }
    th { color: var(--muted); font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    tr.failed { background: var(--red-bg); }
    tr.passed { background: var(--green-bg); }
    tr.gray { background: var(--gray-bg); }
    .status { font-weight: 600; }
    .agent { display: block; font-weight: 400; color: var(--muted); font-size: 0.75rem; }
    tr.failed .status { color: #f3c0bc; }
    tr.passed .status { color: #b7e0c6; }
    tr.gray .status { color: #d1d5db; }
    details { margin-top: 8px; color: var(--muted); }
    code { font-size: 0.8rem; }
    .legend { margin-top: 24px; color: var(--muted); font-size: 0.8125rem; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <h1>ArchSync static board</h1>
    <p class="lede">Knowledge SSOT가 아닙니다. 초록은 “이 컴포넌트가 전부 검증됐다”가 아니라, <strong>지금 검사할 수 있는 유한값 리터럴이 허용값 안</strong>이었다는 뜻입니다. 회색은 사용이 틀렸다는 뜻이 아니라 맞다/틀리다를 말할 수 없다는 뜻입니다.</p>
    <div class="chips">
      <span class="chip failed">빨강 위반 ${board.summary.failed}</span>
      <span class="chip passed">초록 유한값 통과 ${board.summary.checkedPass} · 리터럴 ${board.summary.literalPassed}건</span>
      <span class="chip gray">회색 판정 불가 ${board.summary.uncheckable}</span>
      <span class="chip gray">검사 못 함 ${board.summary.unknown}건</span>
      <span class="chip gray">빈 계약 ${board.summary.emptyContract} · 미사용 ${board.summary.unused}</span>
      <span class="chip gray">파일 ${board.summary.filesScanned} · 컴포넌트 ${board.summary.components}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>component</th>
          <th>QA</th>
          <th>usages</th>
          <th>유한값 통과</th>
          <th>위반</th>
          <th>검사 못 함</th>
          <th>계약</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <p class="legend">
      Agent status(<code>passed</code> / <code>partial</code> / <code>unknown</code> / <code>not-checked</code>)는 그대로 둡니다.
      QA 초록은 유한값 리터럴만 본 레인입니다. <code>color: string</code>, spread, 동적 값, 빈 계약은 통과로 치지 않습니다.
    </p>
  </main>
</body>
</html>
`;
}

function renderHtmlRow(row: StaticBoardRow): string {
  const laneClass =
    row.qaLane === 'failed' ? 'failed' : row.qaLane === 'checked-pass' ? 'passed' : 'gray';
  const extra = renderHtmlDetails(row);

  return `        <tr class="${laneClass}">
          <td>${escapeHtml(row.component)}</td>
          <td class="status">${escapeHtml(QA_LABEL[row.qaLane])}<span class="agent">${escapeHtml(row.status)}</span></td>
          <td class="num">${row.summary.usages}</td>
          <td class="num">${row.summary.passed}</td>
          <td class="num">${row.summary.failed}</td>
          <td class="num">${row.summary.unknown}</td>
          <td>${escapeHtml(contractLabel(row))}${extra}</td>
        </tr>`;
}

function contractLabel(row: StaticBoardRow): string {
  if (row.uncheckableReason) {
    return UNCHECKABLE_LABEL[row.uncheckableReason];
  }

  if (row.finiteValueProps === 0) {
    return '유한값 없음';
  }

  const unknownNote = row.summary.unknown > 0 ? ` · 미검사 prop 있음` : '';
  return `유한값 ${row.finiteValueProps}${unknownNote}`;
}

function renderHtmlDetails(row: StaticBoardRow): string {
  const items: string[] = [];

  for (const violation of row.violations) {
    items.push(
      `<li>${escapeHtml(violation.file)}:${violation.line} ${escapeHtml(violation.component)}.${escapeHtml(violation.prop)} received <code>${escapeHtml(violation.value)}</code> allowed <code>${escapeHtml(violation.allowed.join(' | ') || '(none)')}</code></li>`,
    );
  }

  for (const group of groupUnknown(row.unknown)) {
    items.push(
      `<li>${escapeHtml(row.component)}.${escapeHtml(group.prop)} × ${group.count} — ${escapeHtml(group.reason)}</li>`,
    );
  }

  if (items.length === 0) {
    return '';
  }

  return `<details><summary>detail</summary><ul>${items.join('')}</ul></details>`;
}

function groupUnknown(
  unknown: StaticBoardRow['unknown'],
): Array<{ prop: string; reason: string; count: number }> {
  const counts = new Map<string, { prop: string; reason: string; count: number }>();

  for (const item of unknown) {
    const key = `${item.prop}\0${item.reason}`;
    const current = counts.get(key);

    if (current) {
      current.count += 1;
      continue;
    }

    counts.set(key, { prop: item.prop, reason: item.reason, count: 1 });
  }

  return [...counts.values()].sort((left, right) => right.count - left.count);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
