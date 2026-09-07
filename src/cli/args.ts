export function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

export function flags(argv: string[], name: string): string[] {
  return argv.flatMap((value, index) =>
    value === name && argv[index + 1] ? [argv[index + 1]] : [],
  );
}

export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

export function resolveProjectPath(argv: string[]): string {
  return flag(argv, '--project') ?? '.';
}

const VALUE_FLAGS = new Set([
  '--project',
  '--root',
  '--component',
  '--query',
  '--file',
  '--limit',
  '--debounce',
  '--format',
  '--output',
  '--mode',
  '--harness',
]);

/**
 * `--flag value` 쌍을 건너뛰고 positional 인자만 고른다.
 */
export function positionals(argv: string[]): string[] {
  const values: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current.startsWith('-')) {
      if (VALUE_FLAGS.has(current) && argv[index + 1] && !argv[index + 1].startsWith('-')) {
        index += 1;
      }
      continue;
    }

    values.push(current);
  }

  return values;
}

export const CLI_COMMANDS = [
  'sync',
  'watch',
  'validate',
  'check',
  'context',
  'search',
  'docs',
  'mcp',
  'help',
] as const;

export type CliCommand = (typeof CLI_COMMANDS)[number];

export function isCliCommand(value: string): value is CliCommand {
  return (CLI_COMMANDS as readonly string[]).includes(value);
}

export function printHelp(): void {
  console.log(`ArchSync CLI (v0.x)

Usage:
  archsync <command> [options]

Commands:
  sync                 Incremental Knowledge sync
  watch                Watch sources and run incremental sync
  check                Validate and print a human-readable report
  validate             Validate and print structured JSON
  context [Name]       Get compact component context
  search [query]       Search components by name/alias
  docs [Name]          Render on-demand Markdown from Knowledge
  mcp                  Start MCP stdio server
  help                 Show this help

Common options:
  --strict            Fail sync/check/validate on incomplete coverage
  --project <path>     Frontend project root (default: .)
  --all               Index every Knowledge JSON in one static board
  --format <text|json|markdown|html>
  --output <file>      Write report to a file (html defaults to archsync-board.html)

Examples:
  pnpm exec archsync sync --project .
  pnpm exec archsync search "저장 버튼"
  pnpm exec archsync context Button
  pnpm exec archsync check --component Button --format markdown
  pnpm exec archsync check --all --project . --format html
  pnpm exec archsync validate --component Button --file src/app.tsx
  pnpm exec archsync docs Button
  pnpm exec archsync watch --project .
  pnpm exec archsync mcp

v0.x is pre-1.0. Breaking changes may happen without a major bump.
`);
}
