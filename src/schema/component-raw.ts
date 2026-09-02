import { z } from 'zod';

export const ComponentPropSchema = z.object({
  name: z.string(),
  declaredType: z.string(),
  resolvedType: z.string(),
  values: z.array(z.string()).optional(),
  optional: z.boolean(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
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

export type ComponentRaw = z.infer<typeof ComponentRawSchema>;
