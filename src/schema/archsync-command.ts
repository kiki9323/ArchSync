import { z } from 'zod';

export const ArchsyncCommandParseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ready'),
    trigger: z.literal('/archsync'),
    request: z.string().min(1),
  }),
  z.object({
    status: z.literal('invalid'),
    trigger: z.literal('/archsync'),
    reason: z.literal('empty-request'),
  }),
  z.object({
    status: z.literal('ignored'),
    reason: z.literal('not-archsync-command'),
  }),
]);

export const ArchsyncWorkflowSchema = z.object({
  version: z.literal('0.1'),
  name: z.literal('archsync'),
  trigger: z.literal('/archsync'),
  tools: z.object({
    search: z.literal('archsync_search_context'),
    context: z.literal('archsync_get_component_context'),
    validate: z.literal('archsync_validate'),
  }),
  steps: z.array(z.string().min(1)).min(1),
  rules: z.array(z.string().min(1)).min(1),
});

export type ArchsyncCommandParse = z.infer<typeof ArchsyncCommandParseSchema>;
export type ArchsyncWorkflow = z.infer<typeof ArchsyncWorkflowSchema>;
