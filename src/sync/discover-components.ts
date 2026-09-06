import { resolveComponentProps } from '../extractor/resolve-component-props.js';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Node, Project, type SourceFile } from 'ts-morph';

import {
  DiscoveredComponentSchema,
  type ComponentDiscoveryReason,
  type DiscoveredComponent,
} from '../schema/knowledge-sync.js';

export const DEFAULT_COMPONENT_ROOTS = [
  'src/components/ui',
  'src/components/shared',
] as const;

export interface DiscoverComponentsInput {
  projectRoot: string;
  componentRoots?: string[];
}

/**
 * 설정된 공통 component root 안의 exported PascalCase JSX functions만 찾는다.
 * 이름의 의미나 역할은 추론하지 않는다.
 */
export async function discoverComponents(
  input: DiscoverComponentsInput,
): Promise<DiscoveredComponent[]> {
  const projectRoot = path.resolve(input.projectRoot);
  const componentRoots = input.componentRoots ?? [...DEFAULT_COMPONENT_ROOTS];
  const files = (
    await Promise.all(
      componentRoots.map((root) => collectComponentFiles(projectRoot, root)),
    )
  )
    .flat()
    .sort(compareText);
  const project = new Project({
    tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
  });
  const discovered = new Map<string, DiscoveredComponent>();

  for (const file of files) {
    const sourceFile =
      project.getSourceFile(file) ?? project.addSourceFileAtPath(file);

    for (const component of discoverSourceFile(projectRoot, sourceFile)) {
      const key = `${component.modulePath}:${component.exportName}`;

      if (!discovered.has(key)) {
        discovered.set(key, component);
      }
    }
  }

  return [...discovered.values()].sort(compareComponents);
}

function discoverSourceFile(
  projectRoot: string,
  sourceFile: SourceFile,
): DiscoveredComponent[] {
  const result: DiscoveredComponent[] = [];
  const defaultExportNames = new Set(
    sourceFile
      .getExportAssignments()
      .filter((assignment) => !assignment.isExportEquals())
      .map((assignment) => assignment.getExpression())
      .filter(Node.isIdentifier)
      .map((identifier) => identifier.getText()),
  );

  for (const declaration of sourceFile.getFunctions()) {
    const name = declaration.getName();

    if (!name || !isPascalCase(name) || !hasJsx(declaration)) {
      continue;
    }

    const reason = declaration.isDefaultExport()
      ? 'default-react-component-export'
      : declaration.isExported()
        ? 'named-react-component-export'
        : defaultExportNames.has(name)
          ? 'default-react-component-export'
          : undefined;

    if (reason) {
      result.push(
        createDiscoveredComponent(projectRoot, sourceFile, name, reason),
      );
    }
  }

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const name = declaration.getName();

    if (!isPascalCase(name) || !hasJsx(declaration)) {
      continue;
    }

    const statement = declaration.getVariableStatement();
    const reason = statement?.isExported()
      ? 'named-react-component-export'
      : defaultExportNames.has(name)
        ? 'default-react-component-export'
        : undefined;

    if (reason) {
      result.push(
        createDiscoveredComponent(projectRoot, sourceFile, name, reason),
      );
    }
  }

  // Public compound APIs, e.g. export const Tabs = { Root: TabsRoot }.
  // Keep the implementation name for extraction and the public member path for provenance.
  for (const [exportName, declarations] of sourceFile.getExportedDeclarations()) {
    for (const declaration of declarations) {
      if (declaration.getSourceFile() !== sourceFile) continue;
      if (Node.isFunctionDeclaration(declaration) || Node.isVariableDeclaration(declaration)) {
        const name = declaration.getName();
        if (name && isPascalCase(name) && hasJsx(declaration) && !result.some(item => item.name === name)) {
          result.push(createDiscoveredComponent(projectRoot, sourceFile, name, 'named-react-component-export', exportName));
        }
      }
      if (!Node.isVariableDeclaration(declaration)) continue;
      const initializer = declaration.getInitializer();
      if (!initializer || !Node.isObjectLiteralExpression(initializer)) continue;
      for (const property of initializer.getProperties()) {
        if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) continue;
        const value = Node.isPropertyAssignment(property) ? property.getInitializer() : property.getNameNode();
        if (!value || !Node.isIdentifier(value)) continue;
        const name = value.getText();
        const target = sourceFile.getFunction(name) ?? sourceFile.getVariableDeclaration(name);
        if (!target || !isPascalCase(name) || !hasJsx(target) || result.some(item => item.name === name)) continue;
        result.push(createDiscoveredComponent(projectRoot, sourceFile, name, 'compound-react-component-export', `${exportName}.${property.getName()}`));
      }
    }
  }
  return result;
}

function createDiscoveredComponent(
  projectRoot: string,
  sourceFile: SourceFile,
  name: string,
  reason: ComponentDiscoveryReason,
  exportName = name,
): DiscoveredComponent {
  let propsInterfaceName: string | undefined;
  let propsResolution: string | undefined;
  let propsReason: string | undefined;
  try {
    const props = resolveComponentProps(sourceFile, name);
    propsInterfaceName = props.name;
    propsResolution = props.kind;
  } catch (error) {
    propsReason = error instanceof Error ? error.message : String(error);
  }

  return DiscoveredComponentSchema.parse({
    name,
    modulePath: toProjectPath(projectRoot, sourceFile.getFilePath()),
    exportName,
    propsInterfaceName,
    propsResolution,
    propsReason,
    reason,
  });
}

function hasJsx(node: Node): boolean {
  return node
    .getDescendants()
    .some(
      (descendant) =>
        Node.isJsxElement(descendant) ||
        Node.isJsxSelfClosingElement(descendant) ||
        Node.isJsxFragment(descendant),
    );
}

function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

async function collectComponentFiles(
  projectRoot: string,
  configuredRoot: string,
): Promise<string[]> {
  const root = path.resolve(projectRoot, configuredRoot);
  const relativeRoot = path.relative(projectRoot, root);

  if (relativeRoot.startsWith('..') || path.isAbsolute(relativeRoot)) {
    throw new Error(`Component root is outside project: ${configuredRoot}`);
  }

  const entries = await fs.readdir(root, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return [];
      }

      throw error;
    },
  );
  const files: string[] = [];

  for (const entry of entries) {
    const file = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectComponentFiles(projectRoot, toProjectPath(projectRoot, file))));
      continue;
    }

    if (
      entry.isFile() &&
      /\.tsx$/.test(entry.name) &&
      !/\.(stories|test|spec)\.tsx$/.test(entry.name)
    ) {
      files.push(file);
    }
  }

  return files;
}

function compareComponents(
  left: DiscoveredComponent,
  right: DiscoveredComponent,
): number {
  return (
    compareText(left.modulePath, right.modulePath) ||
    compareText(left.exportName, right.exportName)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toProjectPath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}
