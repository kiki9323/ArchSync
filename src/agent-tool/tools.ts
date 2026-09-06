import { getComponentContext } from '../context/get-component-context.js';
import { searchComponentContexts } from '../context/search-component-contexts.js';
import type { ComponentContextResult } from '../schema/component-context.js';
import type { ComponentSearchResult } from '../schema/component-search.js';
import type { ComponentValidationResult } from '../schema/component-validation.js';
import { runComponentValidation } from '../validator/run-component-validation.js';
import {
  GetComponentContextToolInputSchema,
  SearchContextToolInputSchema,
  ValidateToolInputSchema,
  type GetComponentContextToolInput,
  type SearchContextToolInput,
  type ValidateToolInput,
} from './contracts.js';

/**
 * Agent Tool adapter는 입력 계약을 확인한 뒤 기존 Context Search를 호출할 뿐이다.
 */
export async function searchContextTool(
  input: SearchContextToolInput,
): Promise<ComponentSearchResult> {
  const parsed = SearchContextToolInputSchema.parse(input);

  return searchComponentContexts(parsed.projectPath, parsed.query, {
    limit: parsed.limit,
  });
}

/**
 * Agent Tool adapter는 입력 계약을 확인한 뒤 기존 Context Provider를 호출할 뿐이다.
 */
export async function getComponentContextTool(
  input: GetComponentContextToolInput,
): Promise<ComponentContextResult> {
  const parsed = GetComponentContextToolInputSchema.parse(input);

  return getComponentContext(parsed.projectPath, parsed.component);
}

/**
 * Agent Tool adapter는 입력 계약을 확인한 뒤 기존 validator를 호출할 뿐이다.
 */
export async function validateTool(
  input: ValidateToolInput,
): Promise<ComponentValidationResult> {
  const parsed = ValidateToolInputSchema.parse(input);

  return runComponentValidation(parsed);
}

export const archSyncAgentTools = {
  search_context: searchContextTool,
  get_component_context: getComponentContextTool,
  validate: validateTool,
} as const;
