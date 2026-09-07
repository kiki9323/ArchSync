import { Project, ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { validateComponentUsage } from '../src/validator/validate-component-usage.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

const knowledge: ComponentKnowledge = {
  component: 'Chip',
  nativeProps: [],
  sources: ['chip.tsx'],
  props: [
    {
      name: 'tone',
      type: '"info" | "warn" | undefined',
      optional: true,
      values: ['info', 'warn'],
    },
    {
      name: 'color',
      type: 'string | undefined',
      optional: true,
    },
    {
      name: 'label',
      type: 'string',
      optional: false,
    },
  ],
};

function sourceFileFrom(code: string) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
  });

  return project.createSourceFile('page.tsx', code);
}

describe('validateComponentUsage', () => {
  it('allowed values 밖 리터럴은 violation이다', () => {
    const result = validateComponentUsage(
      knowledge,
      sourceFileFrom(`
        export function Page() {
          return <Chip tone="rainbow" />;
        }
      `),
    );

    expect(result.usages).toBe(1);
    expect(result.checked).toBe(1);
    expect(result.violations).toEqual([
      expect.objectContaining({
        component: 'Chip',
        prop: 'tone',
        value: 'rainbow',
        allowed: ['info', 'warn'],
        line: expect.any(Number),
      }),
    ]);
    expect(result.unknown).toEqual([]);
  });

  it('허용된 리터럴은 checked이고 violation이 없다', () => {
    const result = validateComponentUsage(
      knowledge,
      sourceFileFrom(`
        export function Page() {
          return <Chip tone="info" label="any text" />;
        }
      `),
    );

    expect(result.checked).toBe(1);
    expect(result.violations).toEqual([]);
    expect(result.unknown).toEqual([
      expect.objectContaining({
        prop: 'label',
        reason: 'knowledge has no finite values',
      }),
    ]);
  });

  it('values가 있는 prop의 표현식은 unknown/dynamic expression이다', () => {
    const result = validateComponentUsage(
      knowledge,
      sourceFileFrom(`
        export function Page({ tone }: { tone: string }) {
          return <Chip tone={tone} />;
        }
      `),
    );

    expect(result.checked).toBe(0);
    expect(result.violations).toEqual([]);
    expect(result.unknown).toEqual([
      expect.objectContaining({
        prop: 'tone',
        reason: 'dynamic expression',
      }),
    ]);
  });

  describe('compound member JSX (`<Dialog.Root>`)', () => {
    const dialogRootKnowledge: ComponentKnowledge = {
      component: 'DialogRoot',
      exportName: 'Dialog.Root',
      nativeProps: [],
      sources: ['dialog.tsx'],
      props: [{ name: 'open', type: 'boolean | undefined', optional: true }],
    };

    function projectWithDialog() {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, moduleResolution: ts.ModuleResolutionKind.Bundler },
      });

      project.createSourceFile(
        'dialog.tsx',
        `
          export function DialogRoot(props: { open?: boolean }) { return <div />; }
          export function DialogPopup(props: { children?: unknown }) { return <div />; }
          export const Dialog = { Root: DialogRoot, Popup: DialogPopup };
        `,
      );

      return project;
    }

    it('resolves a public compound member to its implementation and counts a usage', () => {
      const project = projectWithDialog();
      const page = project.createSourceFile(
        'page.tsx',
        `
          import { Dialog } from './dialog';
          export function Page() { return <Dialog.Root open />; }
        `,
      );

      const result = validateComponentUsage(dialogRootKnowledge, page);

      expect(result.usages).toBe(1);
      expect(result.unknown).toEqual([
        expect.objectContaining({ prop: 'open', reason: 'knowledge has no finite values' }),
      ]);
    });

    it('resolves compound members through an import alias', () => {
      const project = projectWithDialog();
      const page = project.createSourceFile(
        'page.tsx',
        `
          import { Dialog as MyDialog } from './dialog';
          export function Page() { return <MyDialog.Root open />; }
        `,
      );

      expect(validateComponentUsage(dialogRootKnowledge, page).usages).toBe(1);
    });

    it('does not match an unrelated compound member with the same property name', () => {
      const project = projectWithDialog();
      project.createSourceFile(
        'dialog.tsx',
        `
          export function PopoverRoot(props: { open?: boolean }) { return <div />; }
          export const Popover = { Root: PopoverRoot };
        `,
        { overwrite: true },
      );
      const page = project.createSourceFile(
        'page.tsx',
        `
          import { Popover } from './dialog';
          export function Page() { return <Popover.Root open />; }
        `,
      );

      expect(validateComponentUsage(dialogRootKnowledge, page).usages).toBe(0);
    });

    it('falls back to the discovery-time public identity when composition cannot be resolved structurally', () => {
      const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
      });
      const page = project.createSourceFile(
        'page.tsx',
        `
          declare const Dialog: { Root: (props: { open?: boolean }) => unknown };
          export function Page() { return <Dialog.Root open />; }
        `,
      );

      expect(validateComponentUsage(dialogRootKnowledge, page).usages).toBe(1);
    });
  });

  it('finite values가 없는 리터럴은 unknown으로 남긴다', () => {
    const result = validateComponentUsage(
      knowledge,
      sourceFileFrom(`
        export function Page() {
          return <Chip color="rainbow" />;
        }
      `),
    );

    expect(result.checked).toBe(0);
    expect(result.violations).toEqual([]);
    expect(result.unknown).toEqual([
      expect.objectContaining({
        prop: 'color',
        reason: 'knowledge has no finite values',
      }),
    ]);
  });
});
