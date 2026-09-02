import { z } from 'zod';

export const ComponentKnowledgePropSchema = z.object({
  name: z.string(),

  // 나중에 LLM enrichment로 추가할 수 있음
  description: z.string().optional(),

  // source code에서 추출한 deterministic facts
  type: z.string(),
  optional: z.boolean(),
  values: z.array(z.string()).optional(),

  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),

  // RAW prop 이름을 구현부에서 추적해 usage evidence가 있을 때만 채운다.
  // isLoading 전용 필드가 아니다.
  behavior: z.string().optional(),
});

export const ComponentKnowledgeSchema = z.object({
  component: z.string(),

  // 이것도 나중에 LLM enrichment 가능
  summary: z.string().optional(),

  nativeProps: z.array(
    z.object({
      source: z.string(),
    }),
  ),

  props: z.array(ComponentKnowledgePropSchema),

  sources: z.array(z.string()),
});

export type ComponentKnowledge = z.infer<typeof ComponentKnowledgeSchema>;
