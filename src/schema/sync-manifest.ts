import { z } from 'zod';

import { ComponentDiscoveryReasonSchema } from './knowledge-sync.js';

/**
 * Incremental sync용 generated metadata.
 * 사람이 편집하지 않는다.
 */
export const SyncManifestComponentSchema = z.object({
  modulePath: z.string().min(1),
  exportName: z.string().min(1),
  propsInterfaceName: z.string().min(1).optional(),
  discoveryReason: ComponentDiscoveryReasonSchema,
  fingerprint: z.string().min(1),
  dependencies: z.array(z.string().min(1)),
});

export const SyncManifestSchema = z.object({
  version: z.literal(1),
  componentRoots: z.array(z.string().min(1)),
  components: z.record(z.string(), SyncManifestComponentSchema),
});

export type SyncManifestComponent = z.infer<typeof SyncManifestComponentSchema>;
export type SyncManifest = z.infer<typeof SyncManifestSchema>;
