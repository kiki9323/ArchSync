import { runArchSyncCli } from './cli.js';

process.exitCode = await runArchSyncCli(['sync', ...process.argv.slice(2)]);
