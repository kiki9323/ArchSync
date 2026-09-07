import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { extractComponent } from '../src/extractor/component.js';
import { discoverComponents } from '../src/sync/discover-components.js';
import { syncKnowledge } from '../src/sync/sync-knowledge.js';

let projectRoot: string;
beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-props-resolution-'));
  await fs.mkdir(path.join(projectRoot, 'src'));
  await fs.mkdir(path.join(projectRoot, 'node_modules/react'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'preserve', strict: true, baseUrl: '.', paths: { '@/*': ['src/*'] } } }));
  await fs.writeFile(path.join(projectRoot, 'node_modules/react/index.d.ts'), `
    export type ComponentProps<T extends ((...args: any[]) => any) | 'button'> = T extends (props: infer P) => any ? P : { disabled?: boolean; title?: string };
    export type ComponentPropsWithoutRef<T extends ((...args: any[]) => any) | 'button'> = Omit<ComponentProps<T>, 'ref'>;
    export type ComponentPropsWithRef<T extends ((...args: any[]) => any) | 'button'> = ComponentProps<T> & { ref?: unknown };
    export interface FC<P> { (props: P): any }
    export function forwardRef<R, P>(render: (props: P, ref: R) => any): (props: P) => any;
    export interface HTMLAttributes<T> { color?: string; hidden?: boolean; }
    export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> { disabled?: boolean; }
  `);
});
afterEach(async () => { await fs.rm(projectRoot, { recursive: true, force: true }); });

async function source(code: string) {
  await fs.writeFile(path.join(projectRoot, 'src/component.tsx'), code);
}
function extract(componentName: string) {
  return extractComponent({ projectRoot, file: 'src/component.tsx', componentName });
}

it('extracts inline intersections and defaults without narrowing to a conventional interface', async () => {
  await source(`interface CardProps { tone?: 'light' | 'dark' }
    export function Card({ tone = 'dark', size: dimension = 'sm' }: CardProps & { size?: 'sm' | 'lg' }) { return <div /> }`);
  expect(extract('Card').customProps).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'tone', values: ['light', 'dark'], defaultValue: 'dark' }),
    expect.objectContaining({ name: 'size', values: ['sm', 'lg'], defaultValue: 'sm' }),
  ]));
});

it('resolves ComponentProps variants through alias imports and barrel exports', async () => {
  await fs.writeFile(path.join(projectRoot, 'src/base.tsx'), `export type BaseProps = { tone?: 'quiet' | 'loud'; required: number }; export function Base(props: BaseProps) { return <div /> }`);
  await fs.writeFile(path.join(projectRoot, 'src/index.ts'), `export { Base as Primitive } from './base';`);
  await source(`import type { ComponentProps, ComponentPropsWithRef, ComponentPropsWithoutRef } from 'react';
    import { Primitive as Base } from '@/index';
    type AliasProps = ComponentProps<typeof Base>;
    export function Alias(props: AliasProps) { return <div /> }
    export function WithRef(props: ComponentPropsWithRef<typeof Base>) { return <div /> }
    export function WithoutRef(props: ComponentPropsWithoutRef<typeof Base>) { return <div /> }
    export function Inline(props: ComponentProps<typeof Base> & { size?: 'sm' | 'lg' }) { return <div /> }`);
  for (const name of ['Alias', 'WithRef', 'WithoutRef', 'Inline']) {
    expect(extract(name).customProps).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'tone', values: ['quiet', 'loud'], source: 'src/base.tsx' }),
      expect.objectContaining({ name: 'required', optional: false }),
    ]));
  }
  expect(extract('Inline').customProps.find(p => p.name === 'size')?.values).toEqual(['sm', 'lg']);
});

it('retains intrinsic ComponentProps as external evidence and observes native booleans', async () => {
  await source(`import type { ComponentProps } from 'react'; export function Button({ disabled }: ComponentProps<'button'>) { return <button disabled={disabled} /> }`);
  const raw = extract('Button');
  expect(raw.customProps).toEqual([]);
  expect(raw.nativeProps.length).toBeGreaterThan(0);
  expect(raw.nativeBooleanAttributes).toEqual([expect.objectContaining({ prop: 'disabled', attribute: 'disabled' })]);
});

it('discovers and syncs compound members, forwardRef inline props, and contextual FC props', async () => {
  await source(`import { forwardRef } from 'react'; import type { FC, ComponentProps } from 'react';
    const Root = (props: ComponentProps<'button'>) => <button />;
    const Field = forwardRef<unknown, { size?: 'sm' | 'lg' }>(({ size = 'sm' }) => <input />);
    const Label: FC<{ tone?: 'light' | 'dark' }> = (props) => <label />;
    export const Input = { Root, Field, Label };
    function Private(props: { ignored: boolean }) { return <div /> }`);
  const discovered = await discoverComponents({ projectRoot, componentRoots: ['src'] });
  expect(discovered.map(c => c.exportName)).toEqual(['Input.Field', 'Input.Label', 'Input.Root']);
  expect(extract('Field').customProps[0]).toMatchObject({ name: 'size', defaultValue: 'sm', values: ['sm', 'lg'] });
  expect(extract('Label').customProps[0].values).toEqual(['light', 'dark']);
  const first = await syncKnowledge({ projectRoot, componentRoots: ['src'] });
  expect(first.coverage).toEqual({ discovered: 3, extracted: 3, skipped: 0, failed: 0 });
  expect((await syncKnowledge({ projectRoot, componentRoots: ['src'] })).summary.unchanged).toBe(3);
});

it('separates no props from unresolved or unsupported props', async () => {
  await source(`import type { ComponentProps } from 'react';
    export function Empty() { return <div /> }
    export function Dynamic(props: any) { return <div /> }
    export function Missing(props: ComponentProps<typeof Unknown>) { return <div /> }
    export function Union(props: { kind: 'a'; a: string } | { kind: 'b'; b: number }) { return <div /> }`);
  const found = await discoverComponents({ projectRoot, componentRoots: ['src'] });
  expect(found.find(c => c.name === 'Empty')?.propsResolution).toBe('no-props');
  for (const name of ['Dynamic', 'Missing', 'Union']) {
    expect(found.find(c => c.name === name)?.propsResolution).toBeUndefined();
    expect(() => extract(name)).toThrow();
  }
  expect(extract('Empty').customProps).toEqual([]);
});

it('prefers an explicit project declaration over a colliding native/external one', async () => {
  await source(`import * as React from 'react';
    type ButtonVariants = { color?: 'red' | 'blue'; size?: 'sm' | 'lg' };
    export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariants;
    export function Button({ color = 'red', size = 'sm' }: ButtonProps) { return <button /> }`);
  const raw = extract('Button');
  expect(raw.customProps.find((p) => p.name === 'color')).toMatchObject({
    declaredType: "'red' | 'blue'",
    values: ['red', 'blue'],
    defaultValue: 'red',
    source: 'src/component.tsx',
  });
  expect(raw.customProps.find((p) => p.name === 'size')).toMatchObject({
    values: ['sm', 'lg'],
  });
});

it('prefers the project declaration regardless of intersection order', async () => {
  await source(`import * as React from 'react';
    type ButtonVariants = { size?: 'sm' | 'lg' };
    export type ButtonProps = ButtonVariants & React.ButtonHTMLAttributes<HTMLButtonElement>;
    export function Button({ size = 'sm' }: ButtonProps) { return <button /> }`);
  expect(extract('Button').customProps.find((p) => p.name === 'size')).toMatchObject({
    values: ['sm', 'lg'],
  });
});

it('keeps native evidence when the project declares no override', async () => {
  await source(`import * as React from 'react';
    export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'lg' };
    export function Button({ size = 'sm' }: ButtonProps) { return <button /> }`);
  const raw = extract('Button');
  expect(raw.customProps.some((p) => p.name === 'disabled')).toBe(false);
  expect(raw.nativeProps).toEqual([
    expect.objectContaining({ source: 'React.ButtonHTMLAttributes<HTMLButtonElement>' }),
  ]);
});

it('recovers a project override hidden behind interface multi-extends shadowing (the real Button shape)', async () => {
  // `interface X extends Native, Project {}` (empty body) does not merge a colliding
  // property into a multi-declaration symbol the way `Native & Project` intersection
  // does — TypeScript exposes only the first heritage clause's declaration. This is
  // the actual deeps-www Button.tsx shape and is not covered by the intersection (`&`)
  // cases above, which take a different code path (declarations().find, not
  // findProjectPropertyOverride's own extends-walk).
  await fs.writeFile(
    path.join(projectRoot, 'src/variants.ts'),
    `export interface CommonButtonProps { color?: 'ghost' | 'primary'; }`,
  );
  await source(`import * as React from 'react';
    import type { CommonButtonProps } from './variants';
    export interface ButtonProps
      extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        CommonButtonProps {}
    export function Button({ color = 'ghost' }: ButtonProps) { return <button /> }`);
  const raw = extract('Button');
  expect(raw.customProps.find((p) => p.name === 'color')).toMatchObject({
    values: ['ghost', 'primary'],
    defaultValue: 'ghost',
    source: 'src/variants.ts',
  });
  expect(raw.nativeProps).toEqual([
    expect.objectContaining({ source: 'React.ButtonHTMLAttributes<HTMLButtonElement>' }),
  ]);
});

it('prefers an imported project declaration over a colliding native one', async () => {
  await fs.writeFile(
    path.join(projectRoot, 'src/variants.ts'),
    `export type ButtonVariants = { color?: 'red' | 'blue' };`,
  );
  await source(`import * as React from 'react';
    import type { ButtonVariants } from './variants';
    export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariants;
    export function Button({ color = 'red' }: ButtonProps) { return <button /> }`);
  expect(extract('Button').customProps.find((p) => p.name === 'color')).toMatchObject({
    values: ['red', 'blue'],
    source: 'src/variants.ts',
  });
});

it('keeps usage evidence inside the extracted component in compound modules', async () => {
  await source(`
    const Root = ({ active }: { active?: boolean }) => <div>{active && <span />}</div>;
    const Label = ({ active }: { active?: boolean }) => <label />;
    export const Group = { Root, Label };
  `);
  expect(extract('Root').customProps[0].usage).toHaveLength(1);
  expect(extract('Label').customProps[0].usage).toBeUndefined();
});
