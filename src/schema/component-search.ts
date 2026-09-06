import { z } from 'zod';

export const ComponentIndexAliasSchema = z.object({
  value: z.string(),
  tokens: z.array(z.string()),
  source: z.enum(['config', 'knowledge']),
});

export const ComponentIndexEntrySchema = z.object({
  component: z.string(),
  tokens: z.array(z.string()),
  aliases: z.array(ComponentIndexAliasSchema),
  provenance: z.object({
    knowledge: z.string(),
    sources: z.array(z.string()),
  }),
});

export const ComponentSearchReasonSchema = z.object({
  kind: z.enum([
    'component-name-exact',
    'component-name-case-insensitive',
    'component-name-normalized',
    'component-name-token',
    'alias-exact',
    'alias-token',
  ]),
  matched: z.string(),
  queryToken: z.string().optional(),
  source: z.enum(['config', 'knowledge']).optional(),
});

export const ComponentSearchMatchSchema = z.object({
  component: z.string(),
  score: z.number().int().positive(),
  reasons: z.array(ComponentSearchReasonSchema).min(1),
  provenance: z.object({
    knowledge: z.string(),
    sources: z.array(z.string()),
  }),
});

export const ComponentSearchResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('matches'),
    query: z.string(),
    matches: z.array(ComponentSearchMatchSchema).min(1),
  }),
  z.object({
    status: z.literal('no-match'),
    query: z.string(),
    matches: z.tuple([]),
  }),
]);

export type ComponentIndexAlias = z.infer<typeof ComponentIndexAliasSchema>;
export type ComponentIndexEntry = z.infer<typeof ComponentIndexEntrySchema>;
export type ComponentSearchReason = z.infer<
  typeof ComponentSearchReasonSchema
>;
export type ComponentSearchMatch = z.infer<
  typeof ComponentSearchMatchSchema
>;
export type ComponentSearchResult = z.infer<
  typeof ComponentSearchResultSchema
>;
