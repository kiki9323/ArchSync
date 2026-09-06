import { runArchSyncCli } from './cli.js';

process.exitCode = await runArchSyncCli(['context', ...process.argv.slice(2)]);
