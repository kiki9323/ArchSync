import path from 'node:path';

import { Node, Project, type SourceFile } from 'ts-morph';

const MAX_DEPTH = 4;

/**
 * Extractor가 실제로 따라갈 수 있는 local source dependency를 수집한다.
 * node_modules / CSS module / story·test는 제외한다.
 */
export function collectComponentDependencies(input: {
  projectRoot: string;
  modulePath: string;
  project?: Project;
}): string[] {
  const projectRoot = path.resolve(input.projectRoot);
  const project =
    input.project ??
    new Project({
      tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
    });
  const absoluteModulePath = path.join(projectRoot, input.modulePath);
  const sourceFile =
    project.getSourceFile(absoluteModulePath) ??
    project.addSourceFileAtPath(absoluteModulePath);
  const dependencies = new Set<string>();

  visitSourceFile(projectRoot, sourceFile, dependencies, 0);

  return [...dependencies].sort(compareText);
}

function visitSourceFile(
  projectRoot: string,
  sourceFile: SourceFile,
  dependencies: Set<string>,
  depth: number,
): void {
  const relativePath = toProjectPath(projectRoot, sourceFile.getFilePath());

  if (!isRelevantDependency(relativePath) || dependencies.has(relativePath)) {
    return;
  }

  if (isExternalSource(projectRoot, sourceFile.getFilePath())) {
    return;
  }

  dependencies.add(relativePath);

  if (depth >= MAX_DEPTH) {
    return;
  }

  for (const declaration of sourceFile.getImportDeclarations()) {
    const referenced = declaration.getModuleSpecifierSourceFile();

    if (referenced) {
      visitSourceFile(projectRoot, referenced, dependencies, depth + 1);
    }
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    const referenced = declaration.getModuleSpecifierSourceFile();

    if (referenced) {
      visitSourceFile(projectRoot, referenced, dependencies, depth + 1);
    }
  }

  for (const statement of sourceFile.getStatements()) {
    if (!Node.isInterfaceDeclaration(statement)) {
      continue;
    }

    for (const heritage of statement.getExtends()) {
      const type = heritage.getType();
      const symbol = type.getSymbol() ?? type.getAliasSymbol();
      const declaration = symbol?.getDeclarations()[0];

      if (!declaration) {
        continue;
      }

      visitSourceFile(
        projectRoot,
        declaration.getSourceFile(),
        dependencies,
        depth + 1,
      );
    }
  }
}

function isRelevantDependency(relativePath: string): boolean {
  if (!/\.tsx?$/.test(relativePath)) {
    return false;
  }

  return !/\.(css|stories|test|spec)\.[^/]+$/.test(relativePath);
}

function isExternalSource(projectRoot: string, filePath: string): boolean {
  const relativePath = path.relative(projectRoot, filePath);

  return (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath) ||
    relativePath.includes(`${path.sep}node_modules${path.sep}`) ||
    relativePath.startsWith(`node_modules${path.sep}`)
  );
}

function toProjectPath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
