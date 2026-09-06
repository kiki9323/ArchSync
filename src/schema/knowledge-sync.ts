import { z } from 'zod';

/**
 * Sync/discovery 설정. componentAliases는 retrieval vocabulary만 보완한다.
 * variant/size 같은 제품 contract는 Knowledge SSOT에 두지 않는다.
 */
export const KnowledgeSyncConfigSchema = z.object({
  componentRoots: z.array(z.string().min(1)).min(1).optional(),
  componentAliases: z
    .record(z.string(), z.array(z.string().min(1)))
    .optional(),
});

export const ComponentDiscoveryReasonSchema = z.enum([
  'named-react-component-export',
  'default-react-component-export',
]);

export const DiscoveredComponentSchema = z.object({
  name: z.string(),
  modulePath: z.string(),
  exportName: z.string(),
  propsInterfaceName: z.string().optional(),
  reason: ComponentDiscoveryReasonSchema,
});

export const SyncComponentResultSchema = z.object({
  component: z.string(),
  modulePath: z.string(),
  exportName: z.string(),
  discoveryReason: ComponentDiscoveryReasonSchema,
  status: z.enum([
    'created',
    'updated',
    'unchanged',
    'skipped',
    'failed',
    'deleted',
  ]),
  reason: z.string().optional(),
});

export const KnowledgeSyncResultSchema = z.object({
  status: z.literal('ready'),
  mode: z.literal('incremental-sync'),
  project: z.string(),
  componentRoots: z.array(z.string()),
  summary: z.object({
    discovered: z.number().int().nonnegative(),
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    deleted: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    extracted: z.number().int().nonnegative(),
  }),
  components: z.array(SyncComponentResultSchema),
});

export type ComponentDiscoveryReason = z.infer<
  typeof ComponentDiscoveryReasonSchema
>;
export type KnowledgeSyncConfig = z.infer<typeof KnowledgeSyncConfigSchema>;
export type DiscoveredComponent = z.infer<typeof DiscoveredComponentSchema>;
export type SyncComponentResult = z.infer<
  typeof SyncComponentResultSchema
>;
export type KnowledgeSyncResult = z.infer<typeof KnowledgeSyncResultSchema>;
