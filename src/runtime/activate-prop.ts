/**
 * Story args로 주입할 수 있는 값만 반환한다.
 * boolean이면 true. ReactNode 등은 주입 불가라 undefined → observation 없음(missing).
 * prop 이름은 보지 않는다.
 */
export function activationValue(propType: string): string | undefined {
  if (/\bboolean\b/.test(propType)) {
    return 'true';
  }

  return undefined;
}
