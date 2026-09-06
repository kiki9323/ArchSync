import { describe, expect, it } from 'vitest';

import {
  flag,
  isCliCommand,
  resolveProjectPath,
} from '../src/cli/args.js';
import { runArchSyncCli } from '../src/cli.js';

describe('ArchSync CLI surface', () => {
  it('recognizes public commands', () => {
    expect(isCliCommand('sync')).toBe(true);
    expect(isCliCommand('watch')).toBe(true);
    expect(isCliCommand('validate')).toBe(true);
    expect(isCliCommand('check')).toBe(true);
    expect(isCliCommand('docs')).toBe(true);
    expect(isCliCommand('context')).toBe(true);
    expect(isCliCommand('search')).toBe(true);
    expect(isCliCommand('mcp')).toBe(true);
    expect(isCliCommand('extract')).toBe(false);
  });

  it('defaults --project to current directory', () => {
    expect(resolveProjectPath([])).toBe('.');
    expect(resolveProjectPath(['--project', '/tmp/app'])).toBe('/tmp/app');
    expect(flag(['--query', '버튼'], '--query')).toBe('버튼');
  });

  it('help exits 0 and prints usage', async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (message?: unknown) => {
      lines.push(String(message ?? ''));
    };

    try {
      await expect(runArchSyncCli(['help'])).resolves.toBe(0);
      expect(lines.join('\n')).toContain('archsync <command>');
      expect(lines.join('\n')).toContain('pnpm exec archsync sync --project .');
      expect(lines.join('\n')).toContain('pnpm exec archsync check');
      expect(lines.join('\n')).toContain('v0.x is pre-1.0');
    } finally {
      console.log = original;
    }
  });

  it('unknown command exits 1', async () => {
    const errors: string[] = [];
    const originalError = console.error;
    const originalLog = console.log;
    console.error = (message?: unknown) => {
      errors.push(String(message ?? ''));
    };
    console.log = () => {};

    try {
      await expect(runArchSyncCli(['nope'])).resolves.toBe(1);
      expect(errors.join('\n')).toContain('Unknown command: nope');
    } finally {
      console.error = originalError;
      console.log = originalLog;
    }
  });

  it('validate/context/search require required flags', async () => {
    await expect(runArchSyncCli(['validate', '--project', '.'])).resolves.toBe(
      1,
    );
    await expect(runArchSyncCli(['context', '--project', '.'])).resolves.toBe(1);
    await expect(runArchSyncCli(['search', '--project', '.'])).resolves.toBe(1);
  });
});
