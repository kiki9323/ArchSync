import { z } from 'zod';

export const RuntimeExpectationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('conditional-render'),
    prop: z.string(),
    evidence: z.string().optional(),
  }),
  z.object({
    kind: z.literal('attribute'),
    prop: z.string(),
    attribute: z.string(),
    value: z.boolean(),
  }),
]);

export const RuntimeObservationSchema = z.object({
  prop: z.string(),
  kind: z.enum(['conditional-render', 'attribute']),
  renderChanged: z.boolean().optional(),
  attributes: z.record(z.string(), z.boolean()).optional(),
});

export type RuntimeExpectation = z.infer<typeof RuntimeExpectationSchema>;
export type RuntimeObservation = z.infer<typeof RuntimeObservationSchema>;
