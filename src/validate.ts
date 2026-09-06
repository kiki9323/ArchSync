import { runArchSyncCli } from './cli.js';

process.exitCode = await runArchSyncCli(['validate', ...process.argv.slice(2)]);
