import { z } from 'zod';

import {
  ComponentKnowledgePropSchema,
} from './component-knowledge.js';

export const ComponentContextSchema = z.object({
  status: z.literal('ready'),
  component: z.string(),
  summary: z.string().optional(),
  props: z.array(ComponentKnowledgePropSchema),
  nativeAttributes: z.array(
    z.object({
      prop: z.string(),
      attribute: z.string(),
    }),
  ),
  provenance: z.object({
    knowledge: z.string(),
    sources: z.array(z.string()),
  }),
});

export const MissingComponentContextSchema = z.object({
  status: z.literal('missing'),
  component: z.string(),
  reason: z.literal('knowledge-not-found'),
  provenance: z.object({
    knowledge: z.string(),
  }),
});

export const ComponentContextResultSchema = z.discriminatedUnion('status', [
  ComponentContextSchema,
  MissingComponentContextSchema,
]);

export type ComponentContext = z.infer<typeof ComponentContextSchema>;
export type MissingComponentContext = z.infer<
  typeof MissingComponentContextSchema
>;
export type ComponentContextResult = z.infer<
  typeof ComponentContextResultSchema
>;
