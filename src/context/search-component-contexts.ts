import {
  ComponentSearchResultSchema,
  type ComponentIndexEntry,
  type ComponentSearchMatch,
  type ComponentSearchReason,
  type ComponentSearchResult,
} from '../schema/component-search.js';
import { buildComponentIndex } from './build-component-index.js';
import {
  containsTokenSequence,
  normalizedComponentName,
  queryTokenSequence,
  queryTokens,
} from './component-name-tokens.js';

export interface SearchComponentContextsOptions {
  limit?: number;
}

/**
 * Component name과 Knowledge에 명시된 alias만으로 deterministic 후보를 고른다.
 * LLM / embedding / source fallback / 동의어 추론은 하지 않는다.
 *
 * Scoring:
 * 1. component-name-exact (+5)
 * 2. component-name-case-insensitive (+4)
 * 3. component-name-normalized (+3)
 * 4. alias phrase (+2 + alias token count)
 * 5. component-name-token (+1 each)
 *
 * 더 긴 alias phrase가 짧은 alias보다 높은 점수를 받는다.
 * 예: "링크 버튼"(+4) > "버튼"(+3)
 */
export async function searchComponentContexts(
  projectPath: string,
  query: string,
  options: SearchComponentContextsOptions = {},
): Promise<ComponentSearchResult> {
  const index = await buildComponentIndex(projectPath);
  const limit = normalizeLimit(options.limit);
  const matches = index
    .map((entry) => matchEntry(entry, query))
    .filter((match): match is ComponentSearchMatch => match !== undefined)
    .sort(compareMatches)
    .slice(0, limit);

  if (matches.length === 0) {
    return ComponentSearchResultSchema.parse({
      status: 'no-match',
      query,
      matches: [],
    });
  }

  return ComponentSearchResultSchema.parse({
    status: 'matches',
    query,
    matches,
  });
}

function matchEntry(
  entry: ComponentIndexEntry,
  query: string,
): ComponentSearchMatch | undefined {
  const trimmedQuery = query.trim();
  const reasons: ComponentSearchReason[] = [];
  let score = 0;

  if (trimmedQuery === entry.component) {
    score += 5;
    reasons.push({
      kind: 'component-name-exact',
      matched: entry.component,
    });
  } else if (trimmedQuery.toLowerCase() === entry.component.toLowerCase()) {
    score += 4;
    reasons.push({
      kind: 'component-name-case-insensitive',
      matched: trimmedQuery,
    });
  } else if (
    normalizedComponentName(trimmedQuery) ===
    normalizedComponentName(entry.component)
  ) {
    score += 3;
    reasons.push({
      kind: 'component-name-normalized',
      matched: trimmedQuery,
    });
  }

  const tokenSet = new Set(queryTokens(query));
  const tokenSequence = queryTokenSequence(query);

  for (const token of entry.tokens) {
    if (!tokenSet.has(token)) {
      continue;
    }

    score += 1;
    reasons.push({
      kind: 'component-name-token',
      matched: token,
    });
  }

  const queryAliasKey = tokenSequence.join(' ');

  for (const alias of entry.aliases) {
    if (alias.tokens.length === 0) {
      continue;
    }

    const aliasKey = alias.tokens.join(' ');
    const aliasScore = 2 + alias.tokens.length;

    // multi-word alias는 전체 phrase만 인정한다. 부분 token으로 다른 component를 끌어오지 않는다.
    if (queryAliasKey === aliasKey) {
      score += aliasScore;
      reasons.push({
        kind: 'alias-exact',
        matched: alias.value,
        queryToken: aliasKey,
        source: alias.source,
      });
      continue;
    }

    if (containsTokenSequence(tokenSequence, alias.tokens)) {
      score += aliasScore;
      reasons.push({
        kind: 'alias-token',
        matched: alias.value,
        queryToken: aliasKey,
        source: alias.source,
      });
    }
  }

  if (reasons.length === 0) {
    return undefined;
  }

  return {
    component: entry.component,
    score,
    reasons,
    provenance: entry.provenance,
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 5;
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return 5;
  }

  return Math.floor(limit);
}

function compareMatches(
  left: ComponentSearchMatch,
  right: ComponentSearchMatch,
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const normalizedLeft = left.component.toLowerCase();
  const normalizedRight = right.component.toLowerCase();

  if (normalizedLeft < normalizedRight) {
    return -1;
  }

  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  return left.component < right.component
    ? -1
    : left.component > right.component
      ? 1
      : 0;
}
