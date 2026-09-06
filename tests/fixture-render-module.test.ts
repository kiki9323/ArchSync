import { describe, expect, it } from 'vitest';

import { generateFixtureRenderModule, toViteSpecifier } from '../src/runtime/fixture-render-module.js';
import { resolveFixtureTarget } from '../src/runtime/resolve-fixture-target.js';

describe('generateFixtureRenderModule', () => {
  it('imports the real component module, not a mock', () => {
    const source = generateFixtureRenderModule({
      modulePath: 'src/components/ui/button/button.tsx',
      exportName: 'Button',
    });

    expect(source).toContain('from "/src/components/ui/button/button.tsx"');
    expect(source).toContain('import { Button as Component }');
    expect(source).not.toContain('mock');
  });

  it('normalizes windows paths for Vite', () => {
    expect(toViteSpecifier('src\\button.tsx')).toBe('/src/button.tsx');
  });
});

describe('resolveFixtureTarget', () => {
  it('picks the component tsx source', () => {
    expect(
      resolveFixtureTarget({
        component: 'Button',
        sources: [
          'src/components/ui/button/button.tsx',
          'src/components/ui/button/button.types.ts',
        ],
      }),
    ).toEqual({
      modulePath: 'src/components/ui/button/button.tsx',
      exportName: 'Button',
    });
  });
});
