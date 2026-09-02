import { z } from 'zod';

export const PropUsageSchema = z.object({
  kind: z.enum(['conditional', 'logical-condition']),
  context: z.enum(['jsx', 'expression']),
  expression: z.string(),
});

export const ComponentPropSchema = z.object({
  name: z.string(),
  declaredType: z.string(),
  resolvedType: z.string(),
  values: z.array(z.string()).optional(),
  optional: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  usage: z.array(PropUsageSchema).optional(),
  source: z.string(),
});

export const ComponentRawSchema = z.object({
  component: z.string(),
  source: z.string(),
  nativeProps: z.array(
    z.object({
      name: z.string(),
      source: z.string(),
      expanded: z.boolean(),
    }),
  ),
  customProps: z.array(ComponentPropSchema),
});

export type PropUsage = z.infer<typeof PropUsageSchema>;
export type ComponentRaw = z.infer<typeof ComponentRawSchema>;
