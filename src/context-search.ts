import { runArchSyncCli } from './cli.js';

process.exitCode = await runArchSyncCli(['search', ...process.argv.slice(2)]);
