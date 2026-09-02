import fs from 'node:fs';
import path from 'node:path';

import { extractComponent } from './extractor/component.js';
import { buildKnowledgeInput } from './knowledge/build-knowledge-input.js';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

const projectRoot = path.resolve(flag('--project') ?? '../deeps-www');
const file = flag('--file') ?? 'src/components/ui/button/button.tsx';
const propsInterfaceName = flag('--props') ?? 'ButtonProps';

const result = extractComponent({
  projectRoot,
  file,
  propsInterfaceName,
});

const knowledgeInput = buildKnowledgeInput(result);

const rawDir = path.resolve('.knowledge/raw/components');
fs.mkdirSync(rawDir, { recursive: true });
fs.writeFileSync(
  path.join(rawDir, `${result.component}.json`),
  `${JSON.stringify(result, null, 2)}\n`,
);

const inputDir = path.resolve('.knowledge/input/components');
fs.mkdirSync(inputDir, { recursive: true });
fs.writeFileSync(
  path.join(inputDir, `${knowledgeInput.component}.json`),
  `${JSON.stringify(knowledgeInput, null, 2)}\n`,
);

console.dir(knowledgeInput, {
  depth: null,
});
