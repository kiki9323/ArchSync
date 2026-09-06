import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  archsyncSlashWorkflow,
  parseArchsyncCommand,
} from '../src/agent-workflow/archsync-command.js';
import { renderArchsyncCommandMarkdown } from '../src/agent-workflow/render-archsync-command.js';
import { agentToolDefinitions } from '../src/agent-tool/contracts.js';

describe('ArchSync Slash Command / Skill v0.1', () => {
  it('/archsync 요청만 파싱하고 빈 요청은 invalid다', () => {
    expect(parseArchsyncCommand('/archsync 저장 CTA 만들어줘')).toEqual({
      status: 'ready',
      trigger: '/archsync',
      request: '저장 CTA 만들어줘',
    });
    expect(parseArchsyncCommand('/archsync')).toEqual({
      status: 'invalid',
      trigger: '/archsync',
      reason: 'empty-request',
    });
    expect(parseArchsyncCommand('저장 버튼 추가해줘')).toEqual({
      status: 'ignored',
      reason: 'not-archsync-command',
    });
  });

  it('workflow는 기존 MCP tool만 재사용한다', () => {
    expect(archsyncSlashWorkflow.tools).toEqual({
      search: 'archsync_search_context',
      context: 'archsync_get_component_context',
      validate: 'archsync_validate',
    });
    expect(agentToolDefinitions.map((tool) => tool.name)).toEqual([
      'search_context',
      'get_component_context',
      'validate',
    ]);
    expect(archsyncSlashWorkflow.steps).toEqual([
      'parse-request',
      'search_context',
      'get_component_context',
      'implement-from-knowledge',
      'validate-static',
      'fix-from-violations',
      'revalidate',
      'report',
    ]);
  });

  it('workflow에 제품 variant/size나 semantic search를 하드코딩하지 않는다', () => {
    const rendered = renderArchsyncCommandMarkdown();

    expect(rendered).not.toMatch(/filled|outline|primary|h48/);
    expect(rendered).not.toMatch(/embedding|vector/i);
    expect(archsyncSlashWorkflow.rules).toEqual(
      expect.arrayContaining([
        'do not hardcode product variant or size values in this workflow',
        'read component rules only from ArchSync Knowledge or MCP',
      ]),
    );
    expect(renderArchsyncCommandMarkdown()).toBe(rendered);
  });

  it('Cursor skill/command adapter가 같은 tool 계약을 가리킨다', async () => {
    const skill = await fs.readFile(
      path.resolve('.cursor/skills/archsync/SKILL.md'),
      'utf8',
    );
    const command = await fs.readFile(
      path.resolve('.cursor/commands/archsync.md'),
      'utf8',
    );
    const claude = await fs.readFile(
      path.resolve('.claude/commands/archsync.md'),
      'utf8',
    );

    expect(skill).toContain('disable-model-invocation: true');
    expect(skill).toContain('archsync_search_context');
    expect(skill).toContain('archsync_get_component_context');
    expect(skill).toContain('archsync_validate');
    expect(command).toContain('archsync_validate');
    expect(claude).toContain('$ARGUMENTS');
    expect(claude).toContain('archsync_search_context');
  });
});
