import { z } from 'zod';

export const ComponentBehaviorSchema = z.object({
  kind: z.enum(['conditional-render', 'conditional-logic']),
  evidence: z.string().optional(),
});

export const ComponentKnowledgePropSchema = z.object({
  name: z.string(),
  description: z.string().optional(),

  // source code에서 추출한 deterministic facts
  type: z.string(),
  optional: z.boolean(),
  values: z.array(z.string()).optional(),

  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),

  // RAW usage evidence를 context로만 변환한다. prop 이름 hardcoding 금지.
  behavior: z.array(ComponentBehaviorSchema).optional(),
});

/**
 * Retrieval vocabulary만. Search가 동의어를 추론하지 않는다.
 * source는 project config 또는 Knowledge에 명시된 metadata만 허용한다.
 */
export const ComponentSearchAliasSchema = z.object({
  value: z.string().min(1),
  source: z.enum(['config', 'knowledge']),
});

export const ComponentSearchMetadataSchema = z.object({
  aliases: z.array(ComponentSearchAliasSchema),
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

  nativeAttributes: z
    .array(
      z.object({
        prop: z.string(),
        attribute: z.string(),
      }),
    )
    .optional(),

  props: z.array(ComponentKnowledgePropSchema),

  sources: z.array(z.string()),

  search: ComponentSearchMetadataSchema.optional(),
});

export type ComponentBehavior = z.infer<typeof ComponentBehaviorSchema>;
export type ComponentSearchAlias = z.infer<typeof ComponentSearchAliasSchema>;
export type ComponentSearchMetadata = z.infer<typeof ComponentSearchMetadataSchema>;
export type ComponentKnowledge = z.infer<typeof ComponentKnowledgeSchema>;
