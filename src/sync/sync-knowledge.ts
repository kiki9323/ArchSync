import fs from 'node:fs/promises';
import path from 'node:path';

import { Project } from 'ts-morph';

import { extractComponent } from '../extractor/component.js';
import {
  knowledgeJsonDirectory,
  rawEvidenceDirectory,
} from '../knowledge/artifact-policy.js';
import { applyComponentSearchAliases } from '../knowledge/apply-search-aliases.js';
import { createComponentKnowledge } from '../knowledge/create-component-knowledge.js';
import { readComponentKnowledge } from '../knowledge/read-component-knowledge.js';
import { writeComponentKnowledge } from '../knowledge/write-component-knowledge.js';
import { writeComponentRaw } from '../knowledge/write-component-raw.js';
import type { ComponentKnowledge } from '../schema/component-knowledge.js';
import {
  KnowledgeSyncResultSchema,
  type DiscoveredComponent,
  type KnowledgeSyncResult,
  type SyncComponentResult,
} from '../schema/knowledge-sync.js';
import type {
  SyncManifest,
  SyncManifestComponent,
} from '../schema/sync-manifest.js';
import { collectComponentDependencies } from './collect-dependencies.js';
import {
  DEFAULT_COMPONENT_ROOTS,
  discoverComponents,
} from './discover-components.js';
import {
  createComponentFingerprint,
  hashFileContents,
} from './fingerprint.js';
import { loadSyncConfig } from './load-sync-config.js';
import { readSyncManifest, writeSyncManifest } from './sync-manifest.js';

export interface SyncKnowledgeInput {
  projectRoot: string;
  componentRoots?: string[];
  componentAliases?: Record<string, string[]>;
}

export interface SyncKnowledgeDependencies {
  extract?: typeof extractComponent;
}

/**
 * Discovery 후 fingerprint로 영향받은 component만 extraction한다.
 * unchanged는 extraction을 실행하지 않는다.
 */
export async function syncKnowledge(
  input: SyncKnowledgeInput,
  dependencies: SyncKnowledgeDependencies = {},
): Promise<KnowledgeSyncResult> {
  const projectRoot = path.resolve(input.projectRoot);
  const config = await loadSyncConfig({ projectRoot });
  const componentRoots = input.componentRoots ?? [...DEFAULT_COMPONENT_ROOTS];
  const componentAliases = input.componentAliases ?? config.componentAliases;
  const previousManifest = await readSyncManifest(projectRoot);
  const discovered = await discoverComponents({ projectRoot, componentRoots });
  const extract = dependencies.extract ?? extractComponent;
  const analysisProject = new Project({
    tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
  });
  const components: SyncComponentResult[] = [];
  const nextComponents: Record<string, SyncManifestComponent> = {};
  const syncedNames = new Set<string>();
  let extracted = 0;

  for (const candidate of discovered) {
    const base = {
      component: candidate.name,
      modulePath: candidate.modulePath,
      exportName: candidate.exportName,
      discoveryReason: candidate.reason,
    };

    if (syncedNames.has(candidate.name)) {
      components.push({
        ...base,
        status: 'skipped',
        reason: 'duplicate-component-name',
      });
      continue;
    }

    syncedNames.add(candidate.name);

    if (!candidate.propsInterfaceName && !candidate.propsResolution) {
      components.push({
        ...base,
        status: 'skipped',
        reason: candidate.propsReason ?? 'props-interface-not-found',
      });
      continue;
    }

    try {
      const dependencyPaths = collectComponentDependencies({
        projectRoot,
        modulePath: candidate.modulePath,
        project: analysisProject,
      });
      const fileHashes = await hashFileContents(projectRoot, dependencyPaths);
      const aliases = componentAliases?.[candidate.name] ?? [];
      const fingerprint = createComponentFingerprint({
        modulePath: candidate.modulePath,
        exportName: candidate.exportName,
        propsInterfaceName: candidate.propsInterfaceName,
        dependencies: fileHashes,
        aliases,
      });
      const previous = previousManifest?.components[candidate.name];
      const knowledgeExists = await hasKnowledge(projectRoot, candidate.name);

      if (
        previous &&
        previous.fingerprint === fingerprint &&
        knowledgeExists &&
        previous.modulePath === candidate.modulePath &&
        previous.exportName === candidate.exportName
      ) {
        nextComponents[candidate.name] = {
          ...previous,
          propsInterfaceName: candidate.propsInterfaceName,
          discoveryReason: candidate.reason,
          fingerprint,
          dependencies: dependencyPaths,
        };
        components.push({
          ...base,
          status: 'unchanged',
          reason: 'fingerprint-match',
        });
        continue;
      }

      extracted += 1;
      const status = await extractAndWrite({
        projectRoot,
        candidate,
        extract,
        aliases,
        project: analysisProject,
      });

      nextComponents[candidate.name] = {
        modulePath: candidate.modulePath,
        exportName: candidate.exportName,
        propsInterfaceName: candidate.propsInterfaceName,
        discoveryReason: candidate.reason,
        fingerprint,
        dependencies: dependencyPaths,
      };
      components.push({
        ...base,
        status,
      });
    } catch (error) {
      components.push({
        ...base,
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      });

      if (previousManifest?.components[candidate.name]) {
        nextComponents[candidate.name] =
          previousManifest.components[candidate.name];
      }
    }
  }

  for (const [name, entry] of Object.entries(
    previousManifest?.components ?? {},
  )) {
    if (syncedNames.has(name) || nextComponents[name]) {
      continue;
    }

    await removeComponentArtifacts(projectRoot, name);
    components.push({
      component: name,
      modulePath: entry.modulePath,
      exportName: entry.exportName,
      discoveryReason: entry.discoveryReason,
      status: 'deleted',
      reason: 'not-discovered',
    });
  }

  const manifest: SyncManifest = {
    version: 1,
    componentRoots,
    components: nextComponents,
  };

  await writeSyncManifest(projectRoot, manifest);

  return KnowledgeSyncResultSchema.parse({
    status: 'ready',
    mode: 'incremental-sync',
    project: projectRoot,
    componentRoots,
    summary: summarize(discovered.length, components, extracted),
    coverage: { discovered: discovered.length, extracted: count(components, 'created') + count(components, 'updated') + count(components, 'unchanged'), skipped: count(components, 'skipped'), failed: count(components, 'failed') },
    components,
  });
}

async function extractAndWrite(input: {
  projectRoot: string;
  candidate: DiscoveredComponent;
  extract: typeof extractComponent;
  aliases: string[];
  project: Project;
}): Promise<'created' | 'updated'> {
  const { projectRoot, candidate, extract, aliases } = input;

  if (!candidate.propsInterfaceName && !candidate.propsResolution) {
    throw new Error('props-interface-not-found');
  }

  const raw = extract({
    projectRoot,
    file: candidate.modulePath,
    propsInterfaceName: candidate.propsInterfaceName,
    componentName: candidate.name,
    project: input.project,
  });
  const previousKnowledge = await readPreviousKnowledge(
    projectRoot,
    raw.component,
  );
  const knowledge = applyComponentSearchAliases(
    createComponentKnowledge(raw, { exportName: candidate.exportName }),
    {
      configAliases: aliases,
      previousKnowledge,
    },
  );
  const existed = previousKnowledge !== undefined;

  await writeComponentRaw(projectRoot, raw);
  await writeComponentKnowledge(projectRoot, knowledge);

  return existed ? 'updated' : 'created';
}

async function readPreviousKnowledge(
  projectRoot: string,
  component: string,
): Promise<ComponentKnowledge | undefined> {
  const result = await readComponentKnowledge(projectRoot, component);

  return result.status === 'found' ? result.knowledge : undefined;
}

async function hasKnowledge(
  projectRoot: string,
  component: string,
): Promise<boolean> {
  const result = await readComponentKnowledge(projectRoot, component);

  return result.status === 'found';
}

async function removeComponentArtifacts(
  projectRoot: string,
  component: string,
): Promise<void> {
  const knowledgePath = path.join(
    projectRoot,
    ...knowledgeJsonDirectory,
    `${component}.json`,
  );
  const rawPath = path.join(
    projectRoot,
    ...rawEvidenceDirectory,
    `${component}.json`,
  );

  await Promise.all([unlinkOptional(knowledgePath), unlinkOptional(rawPath)]);
}

async function unlinkOptional(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function summarize(
  discovered: number,
  components: SyncComponentResult[],
  extracted: number,
): KnowledgeSyncResult['summary'] {
  return {
    discovered,
    created: count(components, 'created'),
    updated: count(components, 'updated'),
    unchanged: count(components, 'unchanged'),
    deleted: count(components, 'deleted'),
    skipped: count(components, 'skipped'),
    failed: count(components, 'failed'),
    extracted,
  };
}

function count(
  components: SyncComponentResult[],
  status: SyncComponentResult['status'],
): number {
  return components.filter((component) => component.status === status).length;
}
