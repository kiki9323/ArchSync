import type { ComponentKnowledgeInput } from './build-knowledge-input.js';

export function buildKnowledgePrompt(input: ComponentKnowledgeInput): string {
  return `
You are analyzing a frontend component.

Your task is to generate concise semantic documentation
using only the provided evidence.

Rules:
- Do not invent props.
- Do not invent allowed values.
- Do not invent default values.
- Do not infer behavior that is not supported by the evidence.
- Write descriptions in Korean.
- Keep descriptions concise.
- Return one description for every provided prop.
- Preserve the exact prop names.

Component evidence:

${JSON.stringify(input, null, 2)}
`.trim();
}
