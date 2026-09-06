#!/usr/bin/env node
import { runArchSyncCli } from '../dist/cli.js';

const code = await runArchSyncCli(process.argv.slice(2));
process.exitCode = code;
