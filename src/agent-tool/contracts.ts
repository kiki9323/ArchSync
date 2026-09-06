import { z } from 'zod';

import { ComponentContextResultSchema } from '../schema/component-context.js';
import { ComponentSearchResultSchema } from '../schema/component-search.js';
import {
  ComponentValidationResultSchema,
  ValidateHarnessSchema,
  ValidateModeSchema,
} from '../schema/component-validation.js';

export const SearchContextToolInputSchema = z.object({
  projectPath: z.string().min(1),
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

export const GetComponentContextToolInputSchema = z.object({
  projectPath: z.string().min(1),
  component: z.string().min(1),
});

export const ValidateToolInputSchema = z.object({
  projectPath: z.string().min(1),
  component: z.string().min(1),
  file: z.string().min(1).optional(),
  mode: ValidateModeSchema.optional(),
  harness: ValidateHarnessSchema.optional(),
  route: z.string().min(1).optional(),
  selector: z.string().min(1).optional(),
  storybookUrl: z.string().min(1).optional(),
  appUrl: z.string().min(1).optional(),
});

export const AgentToolCallSchema = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('search_context'),
    arguments: SearchContextToolInputSchema,
  }),
  z.object({
    name: z.literal('get_component_context'),
    arguments: GetComponentContextToolInputSchema,
  }),
  z.object({
    name: z.literal('validate'),
    arguments: ValidateToolInputSchema,
  }),
]);

export const agentToolDefinitions = [
  {
    name: 'search_context',
    description:
      'Find explainable component candidates from the project Knowledge index.',
    inputSchema: SearchContextToolInputSchema,
    outputSchema: ComponentSearchResultSchema,
  },
  {
    name: 'get_component_context',
    description:
      'Return compact agent-consumable context for one exact component.',
    inputSchema: GetComponentContextToolInputSchema,
    outputSchema: ComponentContextResultSchema,
  },
  {
    name: 'validate',
    description:
      'Validate generated component usage against existing ArchSync Knowledge.',
    inputSchema: ValidateToolInputSchema,
    outputSchema: ComponentValidationResultSchema,
  },
] as const;

export type SearchContextToolInput = z.infer<
  typeof SearchContextToolInputSchema
>;
export type GetComponentContextToolInput = z.infer<
  typeof GetComponentContextToolInputSchema
>;
export type ValidateToolInput = z.infer<typeof ValidateToolInputSchema>;
export type AgentToolCall = z.infer<typeof AgentToolCallSchema>;
