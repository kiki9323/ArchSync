import { Project, ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { extractPropUsages } from '../src/extractor/prop-usage-extractor.js';

describe('extractPropUsages', () => {
  it('records ternary and && usage as expression evidence', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      'button.tsx',
      `
      export function Button(props: { isLoading?: boolean; startIcon?: unknown; size?: string }) {
        const { isLoading, startIcon } = props;
        return isLoading ? null : startIcon && null;
      }
      `,
    );

    const usages = extractPropUsages(sourceFile, ['isLoading', 'startIcon', 'size']);

    expect(usages.get('isLoading')).toEqual([
      expect.objectContaining({
        kind: 'conditional',
        context: 'expression',
      }),
    ]);
    expect(usages.get('startIcon')).toEqual([
      expect.objectContaining({
        kind: 'logical-condition',
        context: 'expression',
      }),
    ]);
    expect(usages.get('size')).toEqual([]);
  });

  it('marks jsx parent chain as jsx context', () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
    });
    const sourceFile = project.createSourceFile(
      'button.tsx',
      `
      export function Button(props: { isLoading?: boolean; startIcon?: unknown }) {
        const { isLoading, startIcon } = props;
        return (
          <div>
            {isLoading ? <span /> : startIcon && <span />}
          </div>
        );
      }
      `,
    );

    const usages = extractPropUsages(sourceFile, ['isLoading', 'startIcon']);

    expect(usages.get('isLoading')).toEqual([
      expect.objectContaining({
        kind: 'conditional',
        context: 'jsx',
      }),
    ]);
    expect(usages.get('startIcon')).toEqual([
      expect.objectContaining({
        kind: 'logical-condition',
        context: 'jsx',
      }),
    ]);
  });
});
