import path from 'node:path';

import { readComponentKnowledge } from './knowledge/read-component-knowledge.js';
import { toRuntimeExpectations } from './validator/to-runtime-expectations.js';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const projectRoot = path.resolve(flag('--project') ?? '../deeps-www');
  const component = flag('--component') ?? 'Button';
  const knowledgeResult = await readComponentKnowledge(projectRoot, component);

  if (knowledgeResult.status === 'missing') {
    throw new Error(`Knowledge not found: ${knowledgeResult.path}`);
  }

  const result = {
    component: knowledgeResult.knowledge.component,
    knowledge: knowledgeResult.path,
    expectations: toRuntimeExpectations(knowledgeResult.knowledge),
  };

  console.log(JSON.stringify(result, null, 2));
}

await main();
