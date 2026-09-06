#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  isCliCommand,
  printHelp,
  type CliCommand,
} from './cli/args.js';
import {
  runCheckCommand,
  runContextCommand,
  runDocsCommand,
  runMcpCommand,
  runSearchCommand,
  runSyncCommand,
  runValidateCommand,
  runWatchCommand,
} from './cli/commands.js';

export async function runArchSyncCli(
  argv: string[] = process.argv.slice(2),
): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }

  if (!isCliCommand(command)) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }

  try {
    return await dispatch(command, rest);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function dispatch(command: CliCommand, argv: string[]): Promise<number> {
  switch (command) {
    case 'sync':
      return runSyncCommand(argv);
    case 'watch':
      return runWatchCommand(argv);
    case 'validate':
      return runValidateCommand(argv);
    case 'check':
      return runCheckCommand(argv);
    case 'context':
      return runContextCommand(argv);
    case 'search':
      return runSearchCommand(argv);
    case 'docs':
      return runDocsCommand(argv);
    case 'mcp':
      return runMcpCommand();
    case 'help':
      printHelp();
      return 0;
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = await runArchSyncCli();
}
