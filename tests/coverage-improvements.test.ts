import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Project, ts } from 'ts-morph';
import { expect, it } from 'vitest';
import { extractComponent } from '../src/extractor/component.js';
import { discoverComponents } from '../src/sync/discover-components.js';
import { validateComponentUsage } from '../src/validator/validate-component-usage.js';
import { serializeUsageValidation } from '../src/validator/serialize-usage-validation.js';

it('extracts imported aliased intersection props through tsconfig paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-coverage-'));
  try {
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, baseUrl: '.', paths: { '@/*': ['./*'] }, jsx: 'preserve' } }));
    await fs.writeFile(path.join(root, 'types.ts'), `interface Base { size?: 'sm' | 'lg' }; export type Props = Base & { tone: 'light' | 'dark' };`);
    await fs.writeFile(path.join(root, 'Chip.tsx'), `import type { Props as ChipInput } from '@/types'; export function Chip(props: ChipInput) { return <div />; }`);
    const discovered = await discoverComponents({ projectRoot: root, componentRoots: ['.'] });
    expect(discovered[0].propsInterfaceName).toBe('ChipInput');
    const raw = extractComponent({ projectRoot: root, file: 'Chip.tsx', propsInterfaceName: 'ChipInput', componentName: 'Chip' });
    expect(raw.customProps).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'size', values: ['sm', 'lg'] }), expect.objectContaining({ name: 'tone', values: ['light', 'dark'] })]));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('resolves renamed and barrel imports without matching unrelated components', () => {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: ts.JsxEmit.Preserve } });
  project.createSourceFile('/chip.tsx', 'export function Chip() { return <div /> }');
  project.createSourceFile('/index.ts', "export { Chip as Badge } from './chip';");
  const source = project.createSourceFile('/page.tsx', `import { Badge as Tag } from './index'; const x = <Tag tone="bad" />;`);
  const knowledge = { component: 'Chip', nativeProps: [], sources: ['chip.tsx'], props: [{ name: 'tone', type: 'string', optional: true, values: ['ok'] }] };
  expect(validateComponentUsage(knowledge, source).violations).toHaveLength(1);
  const unrelated = project.createSourceFile('/other.tsx', `function Chip() {} const x = <Chip tone="bad" />;`);
  expect(validateComponentUsage(knowledge, unrelated).usages).toBe(0);
});

it.each([[0, 0, 'not-checked'], [0, 1, 'unknown'], [1, 1, 'partial'], [1, 0, 'passed']])('reports checked=%s unknown=%s as %s', (checked, unknown, status) => {
  const result = serializeUsageValidation({ component: 'Chip', knowledge: 'chip.json', summary: { filesScanned: 1, usages: 1, checked: Number(checked), violations: 0, unknown: Number(unknown) }, violations: [], unknown: Array.from({ length: Number(unknown) }, () => ({ file: 'page.tsx', line: 1, component: 'Chip', prop: 'tone', reason: 'dynamic expression' as const })) });
  expect(result.status).toBe(status);
});

it('writes the report before strict validation fails on zero checks', async () => {
  const { runArchSyncCli } = await import('../src/cli.js');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-gate-'));
  try {
    await fs.mkdir(path.join(root, '.knowledge/components'), { recursive: true });
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src/page.tsx'), 'const page = <div />;');
    await fs.writeFile(path.join(root, '.knowledge/components/Chip.json'), JSON.stringify({ component: 'Chip', sources: ['chip.tsx'], nativeProps: [], props: [] }));
    const report = path.join(root, 'report.json');
    const args = ['check', '--project', root, '--component', 'Chip', '--format', 'json', '--output', report];
    expect(await runArchSyncCli(args)).toBe(0);
    expect(await runArchSyncCli([...args, '--strict'])).toBe(1);
    expect(JSON.parse(await fs.readFile(report, 'utf8')).status).toBe('not-checked');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

it('counts missing runtime expectations once and returns partial', async () => {
  const { serializeRuntimeValidation } = await import('../src/validator/run-runtime-validation.js');
  const result = serializeRuntimeValidation({ component: 'Chip', knowledgePath: 'chip.json', harness: 'fixture', expectations: [ { prop: 'first', kind: 'conditional-render' }, { prop: 'second', kind: 'conditional-render' } ], produced: { observations: [{ prop: 'first', kind: 'conditional-render', renderChanged: true }], skipped: [{ prop: 'second', reason: 'target-not-found' }] } });
  expect(result.status).toBe('partial');
  expect(result.summary).toEqual({ checked: 1, passed: 1, failed: 0, unknown: 1 });
});

it('strict sync rejects skipped components and preserves coverage on unchanged runs', async () => {
  const { runArchSyncCli } = await import('../src/cli.js');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-sync-gate-'));
  try {
    await fs.writeFile(path.join(root, 'tsconfig.json'), '{"compilerOptions":{"jsx":"preserve"}}');
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src/Chip.tsx'), "type ChipProps = { tone?: 'ok' }; export function Chip(props: ChipProps) { return <div />; }");
    const report = path.join(root, 'report.json');
    const args = ['sync', '--project', root, '--root', 'src', '--strict', '--output', report];
    expect(await runArchSyncCli(args)).toBe(0);
    expect(await runArchSyncCli(args)).toBe(0);
    const unchanged = JSON.parse(await fs.readFile(report, 'utf8'));
    expect(unchanged.summary.extracted).toBe(0);
    expect(unchanged.coverage).toEqual({ discovered: 1, extracted: 1, skipped: 0, failed: 0 });
    await fs.writeFile(path.join(root, 'src/Unknown.tsx'), 'export function Unknown(props: any) { return <div />; }');
    expect(await runArchSyncCli(args)).toBe(1);
    expect(JSON.parse(await fs.readFile(report, 'utf8')).coverage.skipped).toBe(1);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
