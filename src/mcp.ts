import { runArchSyncCli } from './cli.js';

process.exitCode = await runArchSyncCli(['mcp', ...process.argv.slice(2)]);
