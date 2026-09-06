import { normalizeAliasKey } from '../context/component-name-tokens.js';
import {
  ComponentKnowledgeSchema,
  type ComponentKnowledge,
  type ComponentSearchAlias,
} from '../schema/component-knowledge.js';

export interface ApplyComponentSearchAliasesOptions {
  configAliases?: string[];
  previousKnowledge?: ComponentKnowledge;
}

/**
 * Explicit Knowledge alias와 project config alias만 합친다.
 * 코드 의미에서 동의어를 추론하지 않는다.
 */
export function applyComponentSearchAliases(
  knowledge: ComponentKnowledge,
  options: ApplyComponentSearchAliasesOptions = {},
): ComponentKnowledge {
  const merged = new Map<string, ComponentSearchAlias>();

  for (const alias of options.previousKnowledge?.search?.aliases ?? []) {
    if (alias.source === 'knowledge') {
      addAlias(merged, alias);
    }
  }

  for (const alias of knowledge.search?.aliases ?? []) {
    if (alias.source === 'knowledge') {
      addAlias(merged, alias);
    }
  }

  for (const value of options.configAliases ?? []) {
    addAlias(merged, { value, source: 'config' });
  }

  const aliases = [...merged.values()].sort(compareAliases);

  if (aliases.length === 0) {
    const { search: _ignored, ...rest } = knowledge;

    return ComponentKnowledgeSchema.parse(rest);
  }

  return ComponentKnowledgeSchema.parse({
    ...knowledge,
    search: { aliases },
  });
}

function addAlias(
  merged: Map<string, ComponentSearchAlias>,
  alias: ComponentSearchAlias,
): void {
  const trimmed = alias.value.trim();
  const key = normalizeAliasKey(trimmed);

  if (!key) {
    return;
  }

  const existing = merged.get(key);

  if (!existing) {
    merged.set(key, { value: trimmed, source: alias.source });
    return;
  }

  if (existing.source === 'config' && alias.source === 'knowledge') {
    merged.set(key, { value: trimmed, source: 'knowledge' });
  }
}

function compareAliases(
  left: ComponentSearchAlias,
  right: ComponentSearchAlias,
): number {
  const byValue = compareText(left.value, right.value);

  if (byValue !== 0) {
    return byValue;
  }

  return compareText(left.source, right.source);
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();

  if (normalizedLeft < normalizedRight) {
    return -1;
  }

  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  return left < right ? -1 : left > right ? 1 : 0;
}
