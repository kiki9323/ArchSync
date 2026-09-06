import { runArchSyncCli } from './cli.js';

process.exitCode = await runArchSyncCli(['watch', ...process.argv.slice(2)]);
