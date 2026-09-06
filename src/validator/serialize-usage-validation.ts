import {
  StaticValidationResultSchema,
  type StaticValidationResult,
} from '../schema/component-validation.js';
import type { ProjectUsageValidation } from './validate-project-usage.js';

/**
 * 기존 ProjectUsageValidation을 Agent가 소비할 status/summary로만 직렬화한다.
 * 새 rule을 만들지 않는다.
 */
export function serializeUsageValidation(
  result: ProjectUsageValidation,
  file?: string,
): StaticValidationResult {
  const failed = result.violations.length;
  const passed = result.summary.checked - failed;
  const unknown = result.unknown.length;

  return StaticValidationResultSchema.parse({
    status: staticStatus({ failed, checked: result.summary.checked, unknown }),
    mode: 'static',
    component: result.component,
    knowledge: result.knowledge,
    file,
    summary: {
      filesScanned: result.summary.filesScanned,
      usages: result.summary.usages,
      checked: result.summary.checked,
      passed,
      failed,
      unknown,
    },
    violations: result.violations,
    unknown: result.unknown,
  });
}

function staticStatus(input: {
  failed: number;
  checked: number;
  unknown: number;
}): StaticValidationResult['status'] {
  if (input.failed > 0) {
    return 'failed';
  }

  if (input.checked === 0 && input.unknown > 0) {
    return 'unknown';
  }

  if (input.checked === 0) return 'not-checked';
  if (input.unknown > 0) return 'partial';
  return 'passed';
}
