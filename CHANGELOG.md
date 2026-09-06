# Changelog

## 0.1.1

README를 npm 패키지 이름 `archsync-fe`에 맞춘다. 제품 이름 ArchSync와 CLI `archsync`는 그대로 둔다.

## 0.1.0

ArchSync 0.1.0은 React/TypeScript 컴포넌트에서 Knowledge를 추출하고, 이를 AI context와 static/runtime validation에 재사용하는 developer tooling의 첫 공개 버전이다.

포함:

- `sync` / `watch`로 대상 프론트엔드에서 Knowledge JSON SSOT 생성
- `search` / `context`로 Agent가 허용 값·default·behavior를 조회
- `check` / `validate`로 static validation과 human-readable report
- 선택적 runtime validation
- MCP server (`archsync_search_context`, `archsync_get_component_context`, `archsync_validate`)
- CLI와 MCP가 같은 core를 재사용
- npm pack 기준 clean install smoke (`sync` → `search` → `context` → `check` → `mcp`)

이후 버전에서 넣을 것:

- 0.2.x — report 개선, CI / PR check
- 0.3.x — fix suggestion, Storybook addon
- 0.4.x — architecture / dependency rules
