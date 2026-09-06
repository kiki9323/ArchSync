import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { knowledgeArtifactPolicy } from '../src/knowledge/artifact-policy.js';

const knowledgeConsumers = [
  'src/context/get-component-context.ts',
  'src/context/build-component-index.ts',
  'src/validator/validate-project-usage.ts',
  'src/runtime-expect.ts',
  'src/runtime-observe.ts',
];

describe('Knowledge artifact policy', () => {
  it('Knowledge JSON만 persistent SSOT로 둔다', () => {
    expect(knowledgeArtifactPolicy).toEqual({
      code: 'original-source',
      knowledgeJson: 'persistent-ssot',
      rawEvidence: 'cache',
      markdownDocs: 'on-demand',
      syncManifest: 'generated-metadata',
      syncResult: 'ephemeral',
      report: 'ephemeral',
      runtimeObservation: 'ephemeral',
      validationResult: 'ephemeral',
    });
  });

  it('Context / Validator / Docs는 Markdown이 아니라 Knowledge JSON을 읽는다', async () => {
    for (const consumer of knowledgeConsumers) {
      const source = await fs.readFile(path.resolve(consumer), 'utf8');

      expect(source).toContain('readComponentKnowledge');
      expect(source).not.toMatch(/\.md['"`]/);
      expect(source).not.toContain('raw/components');
    }
  });

  it('Docs writer는 Knowledge JSON만 입력으로 Markdown을 파생한다', async () => {
    const source = await fs.readFile(
      path.resolve('src/knowledge/write-component-docs.ts'),
      'utf8',
    );

    expect(source).toContain('ComponentKnowledge');
    expect(source).toContain('renderComponentMarkdown');
    expect(source).not.toContain('raw/components');
  });
});
