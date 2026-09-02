import fs from 'node:fs/promises';
import path from 'node:path';

import { extractComponent } from './extractor/component.js';
import { createComponentKnowledge } from './knowledge/create-component-knowledge.js';
import { writeComponentKnowledge } from './knowledge/write-component-knowledge.js';

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

  const rawDir = path.join(projectRoot, '.knowledge', 'raw', 'components');
  await fs.mkdir(rawDir, { recursive: true });
  await fs.writeFile(
    path.join(rawDir, `${raw.component}.json`),
    `${JSON.stringify(raw, null, 2)}\n`,
    'utf8',
  );

  await writeComponentKnowledge(projectRoot, knowledge);

  console.log(`wrote ${path.join(projectRoot, '.knowledge', 'raw', 'components', `${raw.component}.json`)}`);
  console.log(`wrote ${path.join(projectRoot, '.knowledge', 'components', `${knowledge.component}.json`)}`);
  console.log(`wrote ${path.join(projectRoot, '.knowledge', 'components', `${knowledge.component}.md`)}`);
}

await main();
