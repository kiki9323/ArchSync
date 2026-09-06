import { readComponentKnowledge } from '../knowledge/read-component-knowledge.js';
import {
  ComponentValidationResultSchema,
  type ComponentValidationResult,
  type ValidateHarness,
  type ValidateMode,
} from '../schema/component-validation.js';
import { runRuntimeValidation } from './run-runtime-validation.js';
import { serializeUsageValidation } from './serialize-usage-validation.js';
import { validateProjectUsage } from './validate-project-usage.js';

export interface RunComponentValidationInput {
  projectPath: string;
  component: string;
  file?: string;
  mode?: ValidateMode;
  harness?: ValidateHarness;
  route?: string;
  selector?: string;
  storybookUrl?: string;
  appUrl?: string;
}

/**
 * Knowledge 존재 여부를 확인한 뒤 기존 Static/Runtime validator만 호출한다.
 */
export async function runComponentValidation(
  input: RunComponentValidationInput,
): Promise<ComponentValidationResult> {
  const mode = input.mode ?? 'static';
  const knowledgeResult = await readComponentKnowledge(
    input.projectPath,
    input.component,
  );

  if (knowledgeResult.status === 'missing') {
    return ComponentValidationResultSchema.parse({
      status: 'missing',
      mode,
      component: input.component,
      reason: 'knowledge-not-found',
      provenance: {
        knowledge: knowledgeResult.path,
      },
    });
  }

  if (mode === 'runtime') {
    return runRuntimeValidation({
      projectRoot: input.projectPath,
      knowledge: knowledgeResult.knowledge,
      knowledgePath: knowledgeResult.path,
      harness: input.harness ?? 'fixture',
      file: input.file,
      route: input.route,
      selector: input.selector,
      storybookUrl: input.storybookUrl,
      appUrl: input.appUrl,
    });
  }

  const usage = await validateProjectUsage({
    projectRoot: input.projectPath,
    component: input.component,
    file: input.file,
  });

  return serializeUsageValidation(usage, input.file);
}
