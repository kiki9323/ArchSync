import { z } from 'zod';

/**
 * Final ArchSync knowledge. Facts come from KnowledgeInput.
 * summary / description come from ComponentKnowledgeGeneration.
 */
export const ComponentKnowledgePropSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.string(),
  values: z.array(z.string()).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const ComponentKnowledgeSchema = z.object({
  component: z.string(),
  summary: z.string(),
  nativeProps: z.array(
    z.object({
      source: z.string(),
    }),
  ),
  props: z.array(ComponentKnowledgePropSchema),
  sources: z.array(z.string()),
});

export type ComponentKnowledgeProp = z.infer<typeof ComponentKnowledgePropSchema>;
export type ComponentKnowledge = z.infer<typeof ComponentKnowledgeSchema>;
