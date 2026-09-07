import { existsSync } from 'node:fs';
import path from 'node:path';

import { Project, type SourceFile, ts } from 'ts-morph';

import {
  listComponentKnowledgeNames,
  readComponentKnowledge,
} from '../knowledge/read-component-knowledge.js';
import type { ComponentKnowledge } from '../schema/component-knowledge.js';
import type { StaticValidationResult } from '../schema/component-validation.js';
import { serializeUsageValidation } from './serialize-usage-validation.js';
import {
  collectSourceFiles,
  type ProjectUsageValidation,
} from './validate-project-usage.js';
import {
  validateComponentUsage,
  type UsageUnknown,
  type UsageViolation,
} from './validate-component-usage.js';

export type StaticBoardQaLane = 'failed' | 'checked-pass' | 'uncheckable';

export type StaticBoardUncheckableReason =
  | 'empty-contract'
  | 'no-finite-values'
  | 'unused'
  | 'open-only';

export interface StaticBoardSummary {
  filesScanned: number;
  components: number;
  failed: number;
  /** Agent status `passed`: every seen prop was a finite-value literal. */
  passed: number;
  /** QA lane: at least one finite-value literal passed, and none failed. */
  checkedPass: number;
  uncheckable: number;
  literalPassed: number;
  literalFailed: number;
  unknown: number;
  emptyContract: number;
  unused: number;
}

export interface StaticBoardRow {
  component: string;
  knowledge: string;
  status: StaticValidationResult['status'];
  qaLane: StaticBoardQaLane;
  uncheckableReason?: StaticBoardUncheckableReason;
  emptyContract: boolean;
  finiteValueProps: number;
  summary: StaticValidationResult['summary'];
  violations: StaticValidationResult['violations'];
  unknown: StaticValidationResult['unknown'];
}

/**
 * 기존 check 결과를 인덱싱한 ephemeral 보드.
 * Knowledge SSOT가 아니다.
 */
export interface StaticBoardResult {
  mode: 'static-board';
  project: string;
  summary: StaticBoardSummary;
  rows: StaticBoardRow[];
}

interface LoadedKnowledge {
  knowledge: ComponentKnowledge;
  path: string;
}

interface Accumulator {
  usages: number;
  checked: number;
  violations: UsageViolation[];
  unknown: UsageUnknown[];
}

/**
 * Knowledge JSON을 모두 읽고 src를 한 번만 순회한다.
 * 컴포넌트마다 Project를 다시 열지 않는다.
 */
export async function validateAllProjectUsage(
  projectPath: string,
): Promise<StaticBoardResult> {
  const projectRoot = path.resolve(projectPath);
  const names = await listComponentKnowledgeNames(projectRoot);
  const loaded: LoadedKnowledge[] = [];

  for (const name of names) {
    const result = await readComponentKnowledge(projectRoot, name);

    if (result.status === 'found') {
      loaded.push({ knowledge: result.knowledge, path: result.path });
    }
  }

  const files = loaded.length === 0 ? [] : await collectSourceFiles(projectRoot);
  const accumulators = new Map<string, Accumulator>();

  for (const item of loaded) {
    accumulators.set(item.path, {
      usages: 0,
      checked: 0,
      violations: [],
      unknown: [],
    });
  }

  if (files.length > 0 && loaded.length > 0) {
    const project = new Project({
      ...(existsSync(path.join(projectRoot, 'tsconfig.json'))
        ? { tsConfigFilePath: path.join(projectRoot, 'tsconfig.json') }
        : {}),
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, allowJs: true },
      skipAddingFilesFromTsConfig: true,
    });

    for (const file of files) {
      const sourceFile = project.addSourceFileAtPath(file);

      for (const item of loaded) {
        const usage = fileMayUseComponent(sourceFile, item.knowledge)
          ? validateComponentUsage(item.knowledge, sourceFile)
          : { usages: 0, checked: 0, violations: [], unknown: [] };
        const bucket = accumulators.get(item.path);

        if (!bucket) {
          continue;
        }

        bucket.usages += usage.usages;
        bucket.checked += usage.checked;
        bucket.violations.push(
          ...usage.violations.map((entry) => ({
            ...entry,
            file: toProjectPath(projectRoot, entry.file),
          })),
        );
        bucket.unknown.push(
          ...usage.unknown.map((entry) => ({
            ...entry,
            file: toProjectPath(projectRoot, entry.file),
          })),
        );
      }
    }
  }

  const rows = loaded
    .map((item) =>
      toBoardRow(item, accumulators.get(item.path), files.length),
    )
    .sort(compareBoardRows);

  return {
    mode: 'static-board',
    project: projectRoot,
    summary: summarizeBoard(rows, files.length),
    rows,
  };
}

function toBoardRow(
  item: LoadedKnowledge,
  bucket: Accumulator | undefined,
  filesScanned: number,
): StaticBoardRow {
  const usage: ProjectUsageValidation = {
    component: item.knowledge.component,
    knowledge: item.path,
    summary: {
      filesScanned,
      usages: bucket?.usages ?? 0,
      checked: bucket?.checked ?? 0,
      violations: bucket?.violations.length ?? 0,
      unknown: bucket?.unknown.length ?? 0,
    },
    violations: bucket?.violations ?? [],
    unknown: bucket?.unknown ?? [],
  };
  const serialized = serializeUsageValidation(usage);
  const emptyContract = item.knowledge.props.length === 0;
  const finiteValueProps = item.knowledge.props.filter(
    (prop) => (prop.values?.length ?? 0) > 0,
  ).length;
  const qaLane = toQaLane(serialized.summary);

  return {
    component: serialized.component,
    knowledge: serialized.knowledge,
    status: serialized.status,
    qaLane,
    uncheckableReason: toUncheckableReason({
      qaLane,
      emptyContract,
      finiteValueProps,
      usages: serialized.summary.usages,
    }),
    emptyContract,
    finiteValueProps,
    summary: serialized.summary,
    violations: serialized.violations,
    unknown: serialized.unknown,
  };
}

function toQaLane(summary: StaticValidationResult['summary']): StaticBoardQaLane {
  if (summary.failed > 0) {
    return 'failed';
  }

  if (summary.passed > 0) {
    return 'checked-pass';
  }

  return 'uncheckable';
}

function toUncheckableReason(input: {
  qaLane: StaticBoardQaLane;
  emptyContract: boolean;
  finiteValueProps: number;
  usages: number;
}): StaticBoardUncheckableReason | undefined {
  if (input.qaLane !== 'uncheckable') {
    return undefined;
  }

  if (input.emptyContract) {
    return 'empty-contract';
  }

  if (input.usages === 0) {
    return 'unused';
  }

  if (input.finiteValueProps === 0) {
    return 'no-finite-values';
  }

  return 'open-only';
}

function summarizeBoard(
  rows: StaticBoardRow[],
  filesScanned: number,
): StaticBoardSummary {
  return {
    filesScanned,
    components: rows.length,
    failed: rows.filter((row) => row.qaLane === 'failed').length,
    passed: rows.filter((row) => row.status === 'passed').length,
    checkedPass: rows.filter((row) => row.qaLane === 'checked-pass').length,
    uncheckable: rows.filter((row) => row.qaLane === 'uncheckable').length,
    literalPassed: rows.reduce((sum, row) => sum + row.summary.passed, 0),
    literalFailed: rows.reduce((sum, row) => sum + row.summary.failed, 0),
    unknown: rows.reduce((sum, row) => sum + row.summary.unknown, 0),
    emptyContract: rows.filter((row) => row.emptyContract).length,
    unused: rows.filter((row) => row.summary.usages === 0).length,
  };
}

function compareBoardRows(left: StaticBoardRow, right: StaticBoardRow): number {
  const lane = qaLaneRank(left.qaLane) - qaLaneRank(right.qaLane);

  if (lane !== 0) {
    return lane;
  }

  if (left.uncheckableReason !== right.uncheckableReason) {
    return (
      uncheckableRank(left.uncheckableReason) -
      uncheckableRank(right.uncheckableReason)
    );
  }

  return left.component.localeCompare(right.component);
}

function qaLaneRank(lane: StaticBoardQaLane): number {
  if (lane === 'failed') {
    return 0;
  }

  if (lane === 'checked-pass') {
    return 1;
  }

  return 2;
}

function uncheckableRank(reason: StaticBoardUncheckableReason | undefined): number {
  if (reason === 'open-only') {
    return 0;
  }

  if (reason === 'no-finite-values') {
    return 1;
  }

  if (reason === 'unused') {
    return 2;
  }

  return 3;
}

function fileMayUseComponent(
  sourceFile: SourceFile,
  knowledge: ComponentKnowledge,
): boolean {
  const text = sourceFile.getFullText();

  if (text.includes(knowledge.component)) {
    return true;
  }

  const exportName = knowledge.exportName;

  if (!exportName) {
    return false;
  }

  const root = exportName.split('.')[0];
  return Boolean(root && text.includes(root));
}

function toProjectPath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}
