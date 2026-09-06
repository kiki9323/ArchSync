import { z } from 'zod';

export const ValidateModeSchema = z.enum(['static', 'runtime']);
export const ValidateHarnessSchema = z.enum(['fixture', 'storybook', 'app']);

export const ValidationViolationSchema = z.object({
  file: z.string(),
  line: z.number().int(),
  component: z.string(),
  prop: z.string(),
  value: z.string(),
  allowed: z.array(z.string()),
});

export const ValidationUnknownSchema = z.object({
  file: z.string(),
  line: z.number().int(),
  component: z.string(),
  prop: z.string(),
  reason: z.enum(['knowledge has no finite values', 'dynamic expression', 'spread attribute']),
});

export const ValidationSummarySchema = z.object({
  checked: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});

export const MissingValidationResultSchema = z.object({
  status: z.literal('missing'),
  mode: ValidateModeSchema,
  component: z.string(),
  reason: z.literal('knowledge-not-found'),
  provenance: z.object({
    knowledge: z.string(),
  }),
});

export const StaticValidationResultSchema = z.object({
  status: z.enum(['passed', 'failed', 'unknown', 'partial', 'not-checked']),
  mode: z.literal('static'),
  component: z.string(),
  knowledge: z.string(),
  file: z.string().optional(),
  summary: ValidationSummarySchema.extend({
    filesScanned: z.number().int().nonnegative(),
    usages: z.number().int().nonnegative(),
  }),
  violations: z.array(ValidationViolationSchema),
  unknown: z.array(ValidationUnknownSchema),
});

export const RuntimeSkipSchema = z.object({
  prop: z.string(),
  reason: z.string(),
});

export const RuntimeValidationResultSchema = z.object({
  status: z.enum(['passed', 'failed', 'unknown', 'partial', 'not-checked']),
  mode: z.literal('runtime'),
  harness: ValidateHarnessSchema,
  component: z.string(),
  knowledge: z.string(),
  summary: ValidationSummarySchema,
  comparisons: z.array(
    z.object({
      prop: z.string(),
      kind: z.enum(['conditional-render', 'attribute']),
      status: z.enum(['pass', 'fail', 'missing']),
    }),
  ),
  skipped: z.array(RuntimeSkipSchema),
});

export const ComponentValidationResultSchema = z.union([
  MissingValidationResultSchema,
  StaticValidationResultSchema,
  RuntimeValidationResultSchema,
]);

export type ValidateMode = z.infer<typeof ValidateModeSchema>;
export type ValidateHarness = z.infer<typeof ValidateHarnessSchema>;
export type MissingValidationResult = z.infer<
  typeof MissingValidationResultSchema
>;
export type StaticValidationResult = z.infer<
  typeof StaticValidationResultSchema
>;
export type RuntimeValidationResult = z.infer<
  typeof RuntimeValidationResultSchema
>;
export type ComponentValidationResult = z.infer<
  typeof ComponentValidationResultSchema
>;
