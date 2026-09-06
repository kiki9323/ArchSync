import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { discoverComponents } from '../src/sync/discover-components.js';

describe('discoverComponents', () => {
  const projectRoot = path.resolve('fixtures/sync-project');

  it('configured roots 안의 exported PascalCase JSX component만 찾는다', async () => {
    const components = await discoverComponents({
      projectRoot,
      componentRoots: ['src/components/ui', 'src/components/shared'],
    });

    expect(components).toEqual([
      {
        name: 'Broken',
        modulePath: 'src/components/shared/broken.tsx',
        exportName: 'Broken',
        propsInterfaceName: 'BrokenProps',
        propsResolution: 'interface',
        reason: 'named-react-component-export',
      },
      {
        name: 'Card',
        propsInterfaceName: 'CardProps',
        propsResolution: 'type-alias',
        modulePath: 'src/components/shared/card.tsx',
        exportName: 'Card',
        reason: 'named-react-component-export',
      },
      {
        name: 'Button',
        modulePath: 'src/components/ui/button.tsx',
        exportName: 'Button',
        propsInterfaceName: 'ButtonProps',
        propsResolution: 'interface',
        reason: 'named-react-component-export',
      },
      {
        name: 'Modal',
        modulePath: 'src/components/ui/modal.tsx',
        exportName: 'Modal',
        propsInterfaceName: 'ModalProps',
        propsResolution: 'interface',
        reason: 'default-react-component-export',
      },
    ]);
  });

  it('configured root 밖 component와 JSX가 없는 export를 만들지 않는다', async () => {
    const components = await discoverComponents({
      projectRoot,
      componentRoots: ['src/components/ui'],
    });

    expect(components.map((component) => component.name)).toEqual([
      'Button',
      'Modal',
    ]);
    expect(components.some((component) => component.name === 'Outside')).toBe(
      false,
    );
    expect(components.some((component) => component.name === 'VERSION')).toBe(
      false,
    );
  });

  it('동일 입력의 discovery 순서는 deterministic하다', async () => {
    const input = {
      projectRoot,
      componentRoots: ['src/components/shared', 'src/components/ui'],
    };

    expect(await discoverComponents(input)).toEqual(
      await discoverComponents(input),
    );
  });
});
