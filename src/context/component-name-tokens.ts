/**
 * Component / query / alias 검색에 쓰는 deterministic tokenization.
 * 형태소 분석, 번역, 동의어 확장은 하지 않는다.
 */

function tokenize(value: string): string[] {
  const separated = value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

  if (!separated) {
    return [];
  }

  return separated.split(/\s+/);
}

export function componentNameTokens(value: string): string[] {
  return [...new Set(tokenize(value))];
}

export function normalizedComponentName(value: string): string {
  return componentNameTokens(value).join('');
}

/** 중복 없는 query/alias token set. */
export function queryTokens(query: string): string[] {
  return componentNameTokens(query);
}

/** 연속 phrase(exact alias) 판별용 순서 유지 token 목록. */
export function queryTokenSequence(query: string): string[] {
  return tokenize(query);
}

export function normalizeAliasKey(value: string): string {
  return queryTokenSequence(value).join(' ');
}

export function containsTokenSequence(
  haystack: string[],
  needle: string[],
): boolean {
  if (needle.length === 0 || haystack.length < needle.length) {
    return false;
  }

  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((token, offset) => haystack[index + offset] === token)) {
      return true;
    }
  }

  return false;
}
