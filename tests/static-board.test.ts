import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runArchSyncCli } from '../src/cli.js';
import { renderStaticBoard } from '../src/report/render-static-board.js';
import { listComponentKnowledgeNames } from '../src/knowledge/read-component-knowledge.js';
import { validateAllProjectUsage } from '../src/validator/validate-all-project-usage.js';

async function writeKnowledge(
  projectRoot: string,
  knowledge: Record<string, unknown>,
): Promise<void> {
  const directory = path.join(projectRoot, '.knowledge', 'components');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, `${knowledge.component}.json`),
    `${JSON.stringify(knowledge, null, 2)}\n`,
    'utf8',
  );
}

async function makeBoardProject() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-board-'));
  const srcDir = path.join(projectRoot, 'src', 'pages');
  await fs.mkdir(srcDir, { recursive: true });

  await writeKnowledge(projectRoot, {
    component: 'Chip',
    nativeProps: [],
    sources: ['chip.tsx'],
    props: [
      {
        name: 'tone',
        type: '"info" | "warn" | undefined',
        optional: true,
        values: ['info', 'warn'],
      },
    ],
  });
  await writeKnowledge(projectRoot, {
    component: 'Button',
    nativeProps: [],
    sources: ['button.tsx'],
    props: [
      {
        name: 'variant',
        type: '"filled" | "outline" | undefined',
        optional: true,
        values: ['filled', 'outline'],
      },
      {
        name: 'color',
        type: 'string | undefined',
        optional: true,
      },
    ],
  });
  await writeKnowledge(projectRoot, {
    component: 'Ghost',
    nativeProps: [],
    sources: ['ghost.tsx'],
    props: [],
  });
  await writeKnowledge(projectRoot, {
    component: 'Unused',
    nativeProps: [],
    sources: ['unused.tsx'],
    props: [
      {
        name: 'size',
        type: '"sm" | "md"',
        optional: false,
        values: ['sm', 'md'],
      },
    ],
  });

  await fs.writeFile(
    path.join(srcDir, 'page.tsx'),
    `export function Page() {
  const tone = "info";
  return (
    <>
      <Chip tone="rainbow" />
      <Button variant="filled" color="ghost" />
      <Ghost />
      <Chip tone={tone} />
    </>
  );
}
`,
    'utf8',
  );

  return { projectRoot };
}

describe('static board', () => {
  it('Knowledge 파일 이름만 나열한다', async () => {
    const { projectRoot } = await makeBoardProject();

    await expect(listComponentKnowledgeNames(projectRoot)).resolves.toEqual([
      'Button',
      'Chip',
      'Ghost',
      'Unused',
    ]);
  });

  it('src를 한 번 훑고 기존 check status를 인덱싱한다', async () => {
    const { projectRoot } = await makeBoardProject();
    const board = await validateAllProjectUsage(projectRoot);
    const byName = Object.fromEntries(board.rows.map((row) => [row.component, row]));

    expect(board.mode).toBe('static-board');
    expect(board.summary.filesScanned).toBe(1);
    expect(board.summary.components).toBe(4);
    expect(board.summary.failed).toBe(1);
    expect(board.summary.checkedPass).toBe(1);
    expect(board.summary.passed).toBe(0);
    expect(board.summary.uncheckable).toBe(2);
    expect(board.summary.literalPassed).toBe(1);
    expect(board.summary.emptyContract).toBe(1);
    expect(new Set(board.rows.map((row) => row.summary.filesScanned))).toEqual(new Set([1]));

    expect(byName.Chip.status).toBe('failed');
    expect(byName.Chip.qaLane).toBe('failed');
    expect(byName.Chip.violations).toEqual([
      expect.objectContaining({
        prop: 'tone',
        value: 'rainbow',
        allowed: ['info', 'warn'],
      }),
    ]);
    expect(byName.Chip.unknown).toEqual([
      expect.objectContaining({
        prop: 'tone',
        reason: 'dynamic expression',
      }),
    ]);

    expect(byName.Button.status).toBe('partial');
    expect(byName.Button.qaLane).toBe('checked-pass');
    expect(byName.Button.emptyContract).toBe(false);
    expect(byName.Button.finiteValueProps).toBe(1);
    expect(byName.Button.summary.passed).toBe(1);
    expect(byName.Button.unknown).toEqual([
      expect.objectContaining({
        prop: 'color',
        reason: 'knowledge has no finite values',
      }),
    ]);

    expect(byName.Ghost.status).toBe('not-checked');
    expect(byName.Ghost.qaLane).toBe('uncheckable');
    expect(byName.Ghost.uncheckableReason).toBe('empty-contract');
    expect(byName.Ghost.emptyContract).toBe(true);
    expect(byName.Ghost.summary.usages).toBe(1);

    expect(byName.Unused.status).toBe('not-checked');
    expect(byName.Unused.qaLane).toBe('uncheckable');
    expect(byName.Unused.uncheckableReason).toBe('unused');
    expect(byName.Unused.summary.usages).toBe(0);
    expect(board.rows.map((row) => row.component)).toEqual([
      'Chip',
      'Button',
      'Unused',
      'Ghost',
    ]);
  });

  it('HTML은 빨강/초록/회색 레인과 위반을 보여 준다', async () => {
    const { projectRoot } = await makeBoardProject();
    const html = renderStaticBoard(await validateAllProjectUsage(projectRoot), 'html');

    expect(html).toContain('ArchSync static board');
    expect(html).toContain('Knowledge SSOT가 아닙니다');
    expect(html).toContain('초록 유한값 통과');
    expect(html).toContain('회색 판정 불가');
    expect(html).toContain('class="failed"');
    expect(html).toContain('class="passed"');
    expect(html).toContain('class="gray"');
    expect(html).toContain('received <code>rainbow</code>');
    expect(html).toContain('Button.color × 1');
    expect(html).toContain('빈 계약');
    expect(html).not.toContain('<Chip');
  });

  it('check --all은 HTML을 파일로 쓰고 위반이 있으면 1을 반환한다', async () => {
    const { projectRoot } = await makeBoardProject();
    const output = path.join(projectRoot, 'board.html');
    const lines: string[] = [];
    const original = console.log;
    console.log = (message?: unknown) => {
      lines.push(String(message ?? ''));
    };

    try {
      await expect(
        runArchSyncCli([
          'check',
          '--all',
          '--project',
          projectRoot,
          '--output',
          output,
        ]),
      ).resolves.toBe(1);
    } finally {
      console.log = original;
    }

    const html = await fs.readFile(output, 'utf8');
    expect(html).toContain('<tr class="failed">');
    expect(html).toContain('<tr class="passed">');
    expect(lines.join('\n')).toContain(`wrote ${output}`);
    expect(lines.join('\n')).not.toContain('<!DOCTYPE html>');
  });
});
