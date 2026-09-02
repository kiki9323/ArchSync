import { z } from 'zod';

export const ComponentKnowledgeGenerationSchema = z.object({
  summary: z.string(),
  props: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    }),
  ),
});

export type ComponentKnowledgeGeneration = z.infer<typeof ComponentKnowledgeGenerationSchema>;
