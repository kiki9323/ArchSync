import fs from 'node:fs';
import path from 'node:path';

import { extractComponent } from './extractor/component.js';

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

const outDir = path.resolve('.knowledge/raw/components');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, `${result.component}.json`),
  `${JSON.stringify(result, null, 2)}\n`,
);

console.dir(result, {
  depth: null,
});
