import fs from 'node:fs/promises';
import path from 'node:path';

import type { ComponentValidationResult } from '../schema/component-validation.js';
import type { KnowledgeSyncResult } from '../schema/knowledge-sync.js';
import {
  renderSyncReport,
  renderValidationReport,
  type ReportFormat,
} from '../report/render-archsync-report.js';
import type { StaticBoardFormat } from '../report/render-static-board.js';
import { loadSyncComponentRoots } from '../sync/load-sync-config.js';
import type { StaticBoardResult } from '../validator/validate-all-project-usage.js';
import { syncKnowledge } from '../sync/sync-knowledge.js';
import {
  flag,
  flags,
  hasFlag,
  positionals,
  resolveProjectPath,
} from './args.js';

export async function runSyncCommand(argv: string[]): Promise<number> {
  const projectRoot = path.resolve(resolveProjectPath(argv));
  const componentRoots = await loadSyncComponentRoots({
    projectRoot,
    cliRoots: flags(argv, '--root'),
  });
  const result = await syncKnowledge({ projectRoot, componentRoots });
  const format = resolveOutputFormat(argv, 'json');

  await writeCommandOutput(argv, formatSync(result, format));

  return result.summary.failed > 0 || (hasFlag(argv, '--strict') && (result.summary.skipped > 0 || result.summary.discovered === 0)) ? 1 : 0;
}

export async function runWatchCommand(argv: string[]): Promise<number> {
  const { watchKnowledge } = await import('../sync/watch-knowledge.js');
  const projectRoot = path.resolve(resolveProjectPath(argv));
  const debounceValue = flag(argv, '--debounce');
  const componentRoots = await loadSyncComponentRoots({
    projectRoot,
    cliRoots: flags(argv, '--root'),
  });

  console.log(
    JSON.stringify(
      {
        status: 'watching',
        project: projectRoot,
        componentRoots,
        debounceMs: debounceValue ? Number(debounceValue) : 200,
      },
      null,
      2,
    ),
  );

  const handle = await watchKnowledge(
    {
      projectRoot,
      componentRoots,
      debounceMs: debounceValue ? Number(debounceValue) : undefined,
    },
    {
      onSync(result) {
        console.log(renderSyncReport(result, 'text'));
      },
      onError(error) {
        console.error(
          JSON.stringify(
            {
              status: 'watch-error',
              message: error instanceof Error ? error.message : String(error),
            },
            null,
            2,
          ),
        );
      },
      onFatal(error) {
        console.error(
          JSON.stringify(
            {
              status: 'watch-fatal',
              message: error instanceof Error ? error.message : String(error),
            },
            null,
            2,
          ),
        );
        process.exitCode = 1;
      },
    },
  );

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      await handle.close();
      resolve();
    };

    process.once('SIGINT', () => {
      void shutdown();
    });
    process.once('SIGTERM', () => {
      void shutdown();
    });
  });

  return typeof process.exitCode === 'number' ? process.exitCode : 0;
}

export async function runValidateCommand(argv: string[]): Promise<number> {
  if (hasFlag(argv, '--all')) {
    return runStaticBoardCommand(argv, 'json');
  }

  const result = await runValidation(argv);
  const format = resolveOutputFormat(argv, 'json');

  await writeCommandOutput(argv, formatValidation(result, format));

  return hasFlag(argv, '--strict') && result.status !== 'passed' ? 1 : validationExitCode(result);
}

/**
 * Human-readable check. Same validator as validate, different renderer.
 */
export async function runCheckCommand(argv: string[]): Promise<number> {
  if (hasFlag(argv, '--all')) {
    return runStaticBoardCommand(argv, 'html');
  }

  const result = await runValidation(argv);
  const format = resolveOutputFormat(argv, 'text');

  await writeCommandOutput(argv, formatValidation(result, format));

  return hasFlag(argv, '--strict') && result.status !== 'passed' ? 1 : validationExitCode(result);
}

/**
 * Knowledge JSON을 인덱싱한 ephemeral 보드. SSOT가 아니다.
 */
async function runStaticBoardCommand(
  argv: string[],
  fallback: StaticBoardFormat,
): Promise<number> {
  const { validateAllProjectUsage } = await import(
    '../validator/validate-all-project-usage.js'
  );
  const { renderStaticBoard } = await import('../report/render-static-board.js');
  const projectPath = path.resolve(resolveProjectPath(argv));
  const board = await validateAllProjectUsage(projectPath);
  const format = resolveBoardFormat(argv, fallback);
  const content = renderStaticBoard(board, format);
  const output = flag(argv, '--output') ?? (format === 'html' ? 'archsync-board.html' : undefined);

  if (output) {
    const absolute = path.resolve(output);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, `${content.trimEnd()}\n`, 'utf8');

    if (hasFlag(argv, '--print')) {
      console.log(content);
    } else {
      console.log(`wrote ${absolute}`);
    }
  } else {
    console.log(content);
  }

  return boardExitCode(board, hasFlag(argv, '--strict'));
}

export async function runContextCommand(argv: string[]): Promise<number> {
  const { getComponentContext } = await import(
    '../context/get-component-context.js'
  );
  const projectPath = path.resolve(resolveProjectPath(argv));
  const component = resolveComponentName(argv);

  if (!component) {
    throw new Error('context requires a component name or --component <Name>.');
  }

  const context = await getComponentContext(projectPath, component);
  const format = resolveOutputFormat(argv, 'json');

  await writeCommandOutput(
    argv,
    format === 'json' ? JSON.stringify(context, null, 2) : JSON.stringify(context, null, 2),
  );

  return context.status === 'missing' ? 1 : 0;
}

export async function runSearchCommand(argv: string[]): Promise<number> {
  const { searchComponentContexts } = await import(
    '../context/search-component-contexts.js'
  );
  const projectPath = path.resolve(resolveProjectPath(argv));
  const query = flag(argv, '--query') ?? positionals(argv)[0];
  const limitValue = flag(argv, '--limit');

  if (!query) {
    throw new Error('search requires a query or --query <text>.');
  }

  const result = await searchComponentContexts(projectPath, query, {
    limit: limitValue === undefined ? undefined : Number(limitValue),
  });

  await writeCommandOutput(argv, JSON.stringify(result, null, 2));

  return result.status === 'no-match' ? 1 : 0;
}

export async function runDocsCommand(argv: string[]): Promise<number> {
  const { readComponentKnowledge } = await import(
    '../knowledge/read-component-knowledge.js'
  );
  const { writeComponentDocs } = await import(
    '../knowledge/write-component-docs.js'
  );
  const projectRoot = path.resolve(resolveProjectPath(argv));
  const component = resolveComponentName(argv);

  if (!component) {
    throw new Error('docs requires a component name or --component <Name>.');
  }

  const knowledge = await readComponentKnowledge(projectRoot, component);

  if (knowledge.status === 'missing') {
    console.log(
      JSON.stringify(
        {
          status: 'missing',
          component,
          reason: 'knowledge-not-found',
          provenance: { knowledge: knowledge.path },
        },
        null,
        2,
      ),
    );
    return 1;
  }

  const markdownPath = await writeComponentDocs(projectRoot, knowledge.knowledge);
  console.log(`wrote ${markdownPath}`);
  return 0;
}

export async function runMcpCommand(): Promise<number> {
  const { StdioServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/stdio.js'
  );
  const { createArchSyncMcpServer } = await import('../mcp/server.js');
  const server = createArchSyncMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  return 0;
}

async function runValidation(
  argv: string[],
): Promise<ComponentValidationResult> {
  const { runComponentValidation } = await import(
    '../validator/run-component-validation.js'
  );
  const projectPath = path.resolve(resolveProjectPath(argv));
  const component = resolveComponentName(argv);

  if (!component) {
    throw new Error('requires a component name or --component <Name>.');
  }

  return runComponentValidation({
    projectPath,
    component,
    file: flag(argv, '--file'),
    mode: (flag(argv, '--mode') as 'static' | 'runtime' | undefined) ?? 'static',
    harness: flag(argv, '--harness') as
      | 'fixture'
      | 'storybook'
      | 'app'
      | undefined,
  });
}

function resolveComponentName(argv: string[]): string | undefined {
  return flag(argv, '--component') ?? positionals(argv)[0];
}

function resolveOutputFormat(
  argv: string[],
  fallback: 'text' | 'json' | 'markdown',
): 'text' | 'json' | 'markdown' {
  const value = flag(argv, '--format') ?? fallback;

  if (value === 'text' || value === 'json' || value === 'markdown') {
    return value;
  }

  throw new Error(`Unsupported --format: ${value}`);
}

function resolveBoardFormat(
  argv: string[],
  fallback: StaticBoardFormat,
): StaticBoardFormat {
  const value = flag(argv, '--format') ?? fallback;

  if (value === 'text' || value === 'json' || value === 'markdown' || value === 'html') {
    return value;
  }

  throw new Error(`Unsupported --format: ${value}`);
}

function boardExitCode(board: StaticBoardResult, strict: boolean): number {
  if (board.rows.some((row) => row.status === 'failed')) {
    return 1;
  }

  if (strict && board.rows.some((row) => row.status !== 'passed')) {
    return 1;
  }

  return 0;
}

function formatValidation(
  result: ComponentValidationResult,
  format: 'text' | 'json' | 'markdown',
): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  return renderValidationReport(result, format as ReportFormat);
}

function formatSync(
  result: KnowledgeSyncResult,
  format: 'text' | 'json' | 'markdown',
): string {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  return renderSyncReport(result, format as ReportFormat);
}

async function writeCommandOutput(
  argv: string[],
  content: string,
): Promise<void> {
  const output = flag(argv, '--output');

  if (output) {
    const absolute = path.resolve(output);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, `${content.trimEnd()}\n`, 'utf8');
  }

  if (!output || hasFlag(argv, '--print')) {
    console.log(content);
  } else {
    console.log(`wrote ${path.resolve(output)}`);
  }
}

function validationExitCode(result: ComponentValidationResult): number {
  if (result.status === 'missing' || result.status === 'failed') {
    return 1;
  }

  return 0;
}
