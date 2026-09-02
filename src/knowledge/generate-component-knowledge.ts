import type { LlmClient } from '../llm/llm-client.js';
import { ComponentKnowledgeGenerationSchema } from '../schema/component-knowledge-generation.js';
import { ComponentKnowledgeSchema, type ComponentKnowledge } from '../schema/component-knowledge.js';
import type { ComponentRaw } from '../schema/component-raw.js';
import { buildKnowledgeInput } from './build-knowledge-input.js';
import { buildKnowledgePrompt } from './build-knowledge-prompt.js';
import { createComponentKnowledge } from './create-component-knowledge.js';

export async function generateComponentKnowledge(
  raw: ComponentRaw,
  llm: LlmClient,
): Promise<ComponentKnowledge> {
  const knowledge = createComponentKnowledge(raw);
  const input = buildKnowledgeInput(raw);
  const prompt = buildKnowledgePrompt(input);

  const generated = await llm.generateStructured({
    prompt,
    parse: (value) => ComponentKnowledgeGenerationSchema.parse(value),
  });

  const descriptions = new Map(generated.props.map((prop) => [prop.name, prop.description]));

  return ComponentKnowledgeSchema.parse({
    ...knowledge,
    summary: generated.summary,
    props: knowledge.props.map((prop) => ({
      ...prop,
      description: descriptions.get(prop.name) ?? prop.description,
    })),
  });
}
