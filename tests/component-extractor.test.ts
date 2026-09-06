import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractComponent } from '../src/extractor/component.js';

describe('extractComponent', () => {
  it('extracts component props and default values', () => {
    const projectRoot = path.resolve('fixtures/basic-component');

    const result = extractComponent({
      projectRoot,
      file: 'button.tsx',
      propsInterfaceName: 'ButtonProps',
    });

    expect(result.component).toBe('Button');
    expect(result.source).toBe('button.tsx');

    const variant = result.customProps.find((prop) => prop.name === 'variant');

    expect(variant).toMatchObject({
      name: 'variant',
      declaredType: "'filled' | 'outline' | 'ghost'",
      values: ['filled', 'outline', 'ghost'],
      optional: true,
      defaultValue: 'filled',
      source: 'button.types.ts',
    });

    const size = result.customProps.find((prop) => prop.name === 'size');

    expect(size).toMatchObject({
      values: ['sm', 'md', 'lg'],
      defaultValue: 'md',
    });

    const fullWidth = result.customProps.find((prop) => prop.name === 'fullWidth');

    expect(fullWidth).toMatchObject({
      resolvedType: 'boolean | undefined',
      optional: true,
      defaultValue: false,
    });

    const isLoading = result.customProps.find((prop) => prop.name === 'isLoading');

    expect(isLoading).toMatchObject({
      resolvedType: 'boolean | undefined',
      optional: true,
      defaultValue: false,
      usage: [
        {
          kind: 'conditional',
          context: 'expression',
        },
      ],
    });

    const fullWidthUsage = result.customProps.find((prop) => prop.name === 'fullWidth');

    expect(fullWidthUsage?.usage).toEqual([
      expect.objectContaining({
        kind: 'logical-condition',
        context: 'expression',
      }),
    ]);
  });

  it('collects observable native boolean attributes without flattening them into custom props', () => {
    const projectRoot = path.resolve('fixtures/native-boolean-attrs');

    const button = extractComponent({
      projectRoot,
      file: 'fields.tsx',
      propsInterfaceName: 'ButtonProps',
    });

    expect(button.customProps.map((prop) => prop.name)).toEqual(['isLoading', 'fullWidth']);
    expect(button.nativeBooleanAttributes).toEqual([
      expect.objectContaining({ prop: 'disabled', attribute: 'disabled' }),
    ]);
    expect(button.nativeBooleanAttributes?.some((item) => item.prop === 'hidden')).toBe(false);
    expect(button.nativeBooleanAttributes?.some((item) => item.prop === 'isLoading')).toBe(false);
    expect(button.nativeBooleanAttributes?.some((item) => item.prop === 'fullWidth')).toBe(false);

    const input = extractComponent({
      projectRoot,
      file: 'fields.tsx',
      propsInterfaceName: 'InputProps',
    });

    expect(input.nativeBooleanAttributes).toEqual([
      expect.objectContaining({ prop: 'readOnly', attribute: 'readonly' }),
    ]);
    expect(input.nativeBooleanAttributes?.some((item) => item.prop === 'disabled')).toBe(false);
  });
});
