import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { Project, ts } from 'ts-morph';

import { readComponentKnowledge } from '../knowledge/read-component-knowledge.js';
import {
  validateComponentUsage,
  type UsageUnknown,
  type UsageViolation,
} from './validate-component-usage.js';

export interface ValidateProjectUsageInput {
  projectRoot: string;
  component: string;
  file?: string;
}

export interface ProjectUsageValidation {
  component: string;
  knowledge: string;
  summary: {
    filesScanned: number;
    usages: number;
    checked: number;
    violations: number;
    unknown: number;
  };
  violations: UsageViolation[];
  unknown: UsageUnknown[];
}

export async function validateProjectUsage(
  input: ValidateProjectUsageInput,
): Promise<ProjectUsageValidation> {
  const projectRoot = path.resolve(input.projectRoot);
  const knowledgeResult = await readComponentKnowledge(projectRoot, input.component);

  if (knowledgeResult.status === 'missing') {
    throw new Error(`Knowledge not found: ${knowledgeResult.path}`);
  }

  const knowledge = knowledgeResult.knowledge;
  const files = input.file
    ? [path.resolve(projectRoot, input.file)]
    : await collectSourceFiles(projectRoot);

  const project = new Project({
    ...(existsSync(path.join(projectRoot, 'tsconfig.json')) ? { tsConfigFilePath: path.join(projectRoot, 'tsconfig.json') } : {}),
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, allowJs: true },
    skipAddingFilesFromTsConfig: true,
  });

  const violations: UsageViolation[] = [];
  const unknown: UsageUnknown[] = [];
  let usages = 0;
  let checked = 0;

  for (const file of files) {
    const sourceFile = project.addSourceFileAtPath(file);
    const result = validateComponentUsage(knowledge, sourceFile);

    usages += result.usages;
    checked += result.checked;
    violations.push(
      ...result.violations.map((item) => ({
        ...item,
        file: toProjectPath(projectRoot, item.file),
      })),
    );
    unknown.push(
      ...result.unknown.map((item) => ({
        ...item,
        file: toProjectPath(projectRoot, item.file),
      })),
    );
  }

  return {
    component: knowledge.component,
    knowledge: knowledgeResult.path,
    summary: {
      filesScanned: files.length,
      usages,
      checked,
      violations: violations.length,
      unknown: unknown.length,
    },
    violations,
    unknown,
  };
}

export async function collectSourceFiles(projectRoot: string): Promise<string[]> {
  const root = path.join(path.resolve(projectRoot), 'src');
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => {
    throw new Error(`Source directory not found: ${root}`);
  });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFilesUnder(fullPath)));
      continue;
    }

    if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function collectSourceFilesUnder(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFilesUnder(fullPath)));
      continue;
    }

    if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toProjectPath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}
