import { runArchSyncCli } from './cli.js';

process.exitCode = await runArchSyncCli(['docs', ...process.argv.slice(2)]);
