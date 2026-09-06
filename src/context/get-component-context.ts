import { readComponentKnowledge } from '../knowledge/read-component-knowledge.js';
import {
  ComponentContextResultSchema,
  type ComponentContextResult,
} from '../schema/component-context.js';

/**
 * Knowledge SSOT에서 에이전트에게 필요한 사실만 선택한다.
 *
 * 하지 않는 일:
 * Source/RAW 분석, Knowledge 수정, LLM 호출, 추론, validation.
 */
export async function getComponentContext(
  projectPath: string,
  component: string,
): Promise<ComponentContextResult> {
  const result = await readComponentKnowledge(projectPath, component);

  if (result.status === 'missing') {
    return ComponentContextResultSchema.parse({
      status: 'missing',
      component,
      reason: 'knowledge-not-found',
      provenance: {
        knowledge: result.path,
      },
    });
  }

  const { knowledge } = result;

  return ComponentContextResultSchema.parse({
    status: 'ready',
    component: knowledge.component,
    summary: knowledge.summary,
    props: knowledge.props,
    nativeAttributes: knowledge.nativeAttributes ?? [],
    provenance: {
      knowledge: result.path,
      sources: knowledge.sources,
    },
  });
}
