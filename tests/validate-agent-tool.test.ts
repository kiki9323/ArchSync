import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { invokeAgentTool, validateTool } from '../src/agent-tool/index.js';
import { callMcpValidate } from '../src/mcp/adapter.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';
import { serializeRuntimeValidation } from '../src/validator/run-runtime-validation.js';
import { serializeUsageValidation } from '../src/validator/serialize-usage-validation.js';
import { compareRuntime } from '../src/validator/compare-runtime.js';
import { toRuntimeExpectations } from '../src/validator/to-runtime-expectations.js';
import { validateProjectUsage } from '../src/validator/validate-project-usage.js';

const buttonKnowledge: ComponentKnowledge = {
  component: 'Button',
  nativeProps: [],
  nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
  props: [
    {
      name: 'variant',
      type: '"filled" | "outline" | "underline" | "ghost" | undefined',
      optional: true,
      values: ['filled', 'outline', 'underline', 'ghost'],
      defaultValue: 'filled',
    },
    {
      name: 'color',
      type: 'string | undefined',
      optional: true,
      defaultValue: 'ghost',
    },
  ],
  sources: ['src/components/ui/button/button.tsx'],
};

async function projectWithUsage(source: string): Promise<{
  projectRoot: string;
  file: string;
  knowledgePath: string;
}> {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'archsync-validate-tool-'),
  );
  const knowledgeDir = path.join(projectRoot, '.knowledge', 'components');
  const knowledgePath = path.join(knowledgeDir, 'Button.json');
  const file = 'src/pages/demo.tsx';

  await fs.mkdir(knowledgeDir, { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'src', 'pages'), { recursive: true });
  await fs.writeFile(
    knowledgePath,
    `${JSON.stringify(buttonKnowledge, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(path.join(projectRoot, file), source, 'utf8');

  return { projectRoot, file, knowledgePath };
}

describe('Validate Agent Tool v0.1', () => {
  it('허용된 Button variant는 pass다', async () => {
    const { projectRoot, file } = await projectWithUsage(
      `export function Demo() { return <Button variant="filled" />; }\n`,
    );

    await expect(
      validateTool({
        projectPath: projectRoot,
        component: 'Button',
        file,
      }),
    ).resolves.toMatchObject({
      status: 'passed',
      mode: 'static',
      component: 'Button',
      summary: {
        checked: 1,
        passed: 1,
        failed: 0,
        unknown: 0,
      },
      violations: [],
    });
  });

  it('invalid variant primary는 fail과 allowed values를 남긴다', async () => {
    const { projectRoot, file } = await projectWithUsage(
      `export function Demo() { return <Button variant="primary" />; }\n`,
    );

    await expect(
      validateTool({
        projectPath: projectRoot,
        component: 'Button',
        file,
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      mode: 'static',
      summary: {
        checked: 1,
        passed: 0,
        failed: 1,
        unknown: 0,
      },
      violations: [
        expect.objectContaining({
          file,
          prop: 'variant',
          value: 'primary',
          allowed: ['filled', 'outline', 'underline', 'ghost'],
        }),
      ],
    });
  });

  it('dynamic expression은 unknown 의미를 유지한다', async () => {
    const { projectRoot, file } = await projectWithUsage(
      `export function Demo({ variant }: { variant: string }) { return <Button variant={variant} />; }\n`,
    );

    await expect(
      validateTool({
        projectPath: projectRoot,
        component: 'Button',
        file,
      }),
    ).resolves.toMatchObject({
      status: 'unknown',
      mode: 'static',
      summary: {
        checked: 0,
        passed: 0,
        failed: 0,
        unknown: 1,
      },
      unknown: [
        expect.objectContaining({
          file,
          prop: 'variant',
          reason: 'dynamic expression',
        }),
      ],
    });
  });

  it('없는 Knowledge는 missing이다', async () => {
    const { projectRoot } = await projectWithUsage(
      `export function Demo() { return <Button variant="filled" />; }\n`,
    );

    await expect(
      validateTool({
        projectPath: projectRoot,
        component: 'Modal',
      }),
    ).resolves.toEqual({
      status: 'missing',
      mode: 'static',
      component: 'Modal',
      reason: 'knowledge-not-found',
      provenance: {
        knowledge: '.knowledge/components/Modal.json',
      },
    });
  });

  it('MCP 결과는 기존 validator 결과와 동일하다', async () => {
    const { projectRoot, file } = await projectWithUsage(
      `export function Demo() { return <Button variant="primary" />; }\n`,
    );
    const usage = await validateProjectUsage({
      projectRoot,
      component: 'Button',
      file,
    });
    const mcp = await callMcpValidate({
      projectPath: projectRoot,
      component: 'Button',
      file,
    });

    expect(mcp).toEqual(serializeUsageValidation(usage, file));
    expect(mcp).toEqual(
      await invokeAgentTool({
        name: 'validate',
        arguments: {
          projectPath: projectRoot,
          component: 'Button',
          file,
        },
      }),
    );
  });

  it('Tool layer는 Knowledge를 변경하지 않는다', async () => {
    const { projectRoot, file, knowledgePath } = await projectWithUsage(
      `export function Demo() { return <Button variant="filled" />; }\n`,
    );
    const before = await fs.readFile(knowledgePath, 'utf8');

    await validateTool({
      projectPath: projectRoot,
      component: 'Button',
      file,
    });

    expect(await fs.readFile(knowledgePath, 'utf8')).toBe(before);
  });

  it('같은 입력은 deterministic한 동일 결과를 반환한다', async () => {
    const { projectRoot, file } = await projectWithUsage(
      `export function Demo() { return <Button variant="filled" />; }\n`,
    );
    const call = {
      name: 'validate' as const,
      arguments: {
        projectPath: projectRoot,
        component: 'Button',
        file,
      },
    };

    expect(await invokeAgentTool(call)).toEqual(await invokeAgentTool(call));
  });

  it('runtime 결과는 기존 compareRuntime과 동일하다', () => {
    const expectations = toRuntimeExpectations(buttonKnowledge);
    const produced = {
      observations: [
        {
          prop: 'disabled',
          kind: 'attribute' as const,
          attributes: { disabled: true },
        },
      ],
      skipped: [],
    };
    const serialized = serializeRuntimeValidation({
      component: 'Button',
      knowledgePath: '.knowledge/components/Button.json',
      harness: 'fixture',
      expectations,
      produced,
    });

    expect(serialized.comparisons).toEqual(
      compareRuntime(expectations, produced.observations),
    );
    expect(serialized.status).toBe('passed');
    expect(serialized.mode).toBe('runtime');
    expect(serialized.harness).toBe('fixture');
  });

  it('adapter와 tool source에 validation rule을 복제하지 않는다', async () => {
    const adapterSource = await fs.readFile(
      path.resolve('src/mcp/adapter.ts'),
      'utf8',
    );
    const toolSource = await fs.readFile(
      path.resolve('src/agent-tool/tools.ts'),
      'utf8',
    );

    expect(adapterSource).not.toContain('validateProjectUsage');
    expect(adapterSource).not.toContain('compareRuntime');
    expect(adapterSource).not.toContain('allowed.includes');
    expect(toolSource).toContain('runComponentValidation');
    expect(toolSource).not.toContain('validateComponentUsage');
    expect(toolSource).not.toContain('compareRuntime');
  });
});
