import path from 'node:path';

import { extractComponent } from './extractor/component.js';
import { createComponentKnowledge } from './knowledge/create-component-knowledge.js';
import { writeComponentKnowledge } from './knowledge/write-component-knowledge.js';
import { writeComponentRaw } from './knowledge/write-component-raw.js';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const projectRoot = path.resolve(flag('--project') ?? '../deeps-www');
  const file = flag('--file') ?? 'src/components/ui/button/button.tsx';
  const propsInterfaceName = flag('--props') ?? 'ButtonProps';

  const raw = extractComponent({
    projectRoot,
    file,
    propsInterfaceName,
  });

  const knowledge = createComponentKnowledge(raw);

  await writeComponentRaw(projectRoot, raw);
  await writeComponentKnowledge(projectRoot, knowledge);

  console.log(`wrote ${path.join(projectRoot, '.knowledge', 'raw', 'components', `${raw.component}.json`)}`);
  console.log(`wrote ${path.join(projectRoot, '.knowledge', 'components', `${knowledge.component}.json`)}`);
}

await main();
