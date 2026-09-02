import type { LlmClient } from '../llm/llm-client.js';
import { ComponentKnowledgeGenerationSchema } from '../schema/component-knowledge-generation.js';
import {
  ComponentKnowledgeSchema,
  type ComponentKnowledge,
} from '../schema/component-knowledge.js';
import type { ComponentRaw } from '../schema/component-raw.js';
import { buildKnowledgeInput } from './build-knowledge-input.js';
import { buildKnowledgePrompt } from './build-knowledge-prompt.js';

export async function generateComponentKnowledge(
  raw: ComponentRaw,
  llm: LlmClient,
): Promise<ComponentKnowledge> {
  // 1. RAW evidence에서 LLM에게 필요한 context만 구성
  const input = buildKnowledgeInput(raw);

  // 2. context를 LLM이 수행할 작업이 포함된 prompt로 변환
  const prompt = buildKnowledgePrompt(input);

  // 3. LLM은 summary / description 같은 의미 정보만 생성
  // 생성 결과가 예상한 구조인지 Zod로 검증
  const generated = await llm.generateStructured({
    prompt,
    parse: (value) => ComponentKnowledgeGenerationSchema.parse(value),
  });

  // prop name을 기준으로 LLM이 생성한 description을 찾기 위한 lookup
  const descriptions = new Map(generated.props.map((prop) => [prop.name, prop.description]));

  // 4. LLM이 만든 의미 정보와 RAW에서 추출한 fact를 합친다.
  // type / values / defaultValue는 LLM이 아니라 RAW를 신뢰한다.
  const knowledge = {
    component: input.component,
    summary: generated.summary,

    nativeProps: input.nativeProps.map((source) => ({
      source,
    })),

    props: input.props.map((prop) => ({
      name: prop.name,
      description: descriptions.get(prop.name) ?? '',
      type: prop.type,
      values: prop.values,
      defaultValue: prop.defaultValue,
    })),

    sources: input.sources,
  };

  // 5. 최종 Knowledge도 다시 schema validation을 통과해야 한다.
  return ComponentKnowledgeSchema.parse(knowledge);
}
