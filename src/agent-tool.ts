import { invokeAgentTool } from './agent-tool/invoke-agent-tool.js';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const name = flag('--tool');
  const input = flag('--input');

  if (!name || !input) {
    throw new Error('Agent Tool requires --tool and JSON --input.');
  }

  const result = await invokeAgentTool({
    name,
    arguments: JSON.parse(input),
  });

  console.log(JSON.stringify(result, null, 2));
}

await main();
