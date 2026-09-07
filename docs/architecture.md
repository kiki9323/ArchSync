# ArchSync Architecture

구현·추출·스키마를 바꿀 때 이 문서가 기준이다. 사용자 설치와 CLI 사용법은 [README](../README.md)를 본다.

ArchSync는 컴포넌트 생성기가 아니다. 코드에 이미 있는 공통 UI API를 Knowledge로 고정하고, Coding Agent가 그 계약 안에서 조회·구현·검증하게 한다.

```
Codebase
  → Static Extraction
  → RAW Evidence
  → Knowledge JSON (SSOT)
      → Context / Search / Validation / Agent Tool
      → Claude / Cursor / 다른 Agent
```

에이전트는 소스 전체를 다시 읽지 않는다. Context Provider가 Knowledge를 조회하게 한 뒤 구현한다.

## 신뢰 조건

Knowledge는 RAW 사실의 부분집합이다.

코드에서 사실만 뽑아 RAW로 고정한다. LLM은 그 위에 `summary` / `description`만 얹을 수 있다. Knowledge가 RAW에 없는 값을 가지면 LLM 문제다.

예: RAW `variant`가 `primary | secondary`인데 Knowledge에 `tertiary`가 있으면 오류다.

## 파이프라인

```
TARGET PROJECT       프론트엔드 (tsconfig, node_modules, source)
    │
    ├─ Syntax (AST)          코드에 어떻게 선언되어 있는가
    └─ Type Checker          TypeScript가 최종적으로 어떤 타입으로 이해하는가
    ▼
EXTRACTION LAYER     사실만 추출. 의미·설명·추론 금지
    ▼
RAW JSON             {target}/.knowledge/raw/components/Button.json
    ▼
DETERMINISTIC KNOWLEDGE   createComponentKnowledge — LLM 없음
    ▼
JSON                 {target}/.knowledge/components/Button.json     SSOT
    │
    ├─ Context Provider / Search / Validator / Agent Tool
    └─ on-demand Markdown   archsync docs Button
```

## Target

ArchSync는 컴포넌트를 복붙해서 자체 tsconfig로 돌리지 않는다. 대상 프론트 프로젝트의 TypeScript 환경을 그대로 쓴다.

루트 `tsconfig`는 ArchSync CLI 본체(`src/`, `tests/`)용이다. 추출용 program은 target의 tsconfig를 연다. compiler options뿐 아니라 tsconfig에 포함된 source file도 그대로 넣는다. `skipAddingFilesFromTsConfig`는 쓰지 않는다.

## Knowledge Levels

컴포넌트 Knowledge는 한 문서에 모든 규칙을 넣지 않는다.

| 층 | 내용 | 출처 |
| --- | --- | --- |
| Level 1 API Facts | type / values / default / optional | 코드에서 deterministic |
| Level 2 Semantics | prop 역할, loading 동작, icon 위치 | 구현 usage evidence가 있을 때만 |
| Level 3 Usage Rules | variant 선택 기준, 공통 컴포넌트 강제, 금지 조합 | Convention Knowledge. 컴포넌트 파일에서 추론 금지 |

Level 2 `behavior`는 RAW prop 이름을 구현부에서 추적한 뒤에만 채운다. 특정 prop 이름 hardcoding은 금지한다. RAW `kind` + `context`만으로 변환한다.

Level 3는 컨벤션·디자인 시스템 규칙이다. "CTA는 filled를 쓴다"는 `variant` union에 없고, 컴포넌트 파일만 봐서는 사실이 아니다.

| 질문 | 층 |
| --- | --- |
| allowed values / default가 뭐야? | Level 1 |
| loading일 때 아이콘은? | Level 2 |
| 새 Button을 만들어도 돼? CTA는 어떤 variant? | Level 3 |

## Artifact

CODE가 원본이다. 소비자가 읽는 기계 SSOT는 Knowledge JSON뿐이다.

| Artifact | 수명 | 경로 |
| --- | --- | --- |
| Knowledge JSON | persistent SSOT | `{target}/.knowledge/components/` |
| RAW evidence | cache | `{target}/.knowledge/raw/components/` |
| Markdown | on-demand 파생 뷰 | `archsync docs` |
| Static HTML board | ephemeral | `archsync check --all --format html` — QA 레인은 유한값 리터럴만. Agent status와 별개 |
| sync manifest | generated metadata | `{target}/.knowledge/manifest.json` |
| sync / report / observation / validation | ephemeral | 저장하지 않음 |

출력은 ArchSync 패키지가 아니라 **대상 프로젝트 루트**다.

## Extractor가 답하는 질문

1. 이 파일에 exported component가 있는가?
2. 사용하는 props type은 무엇인가?
3. 그 타입은 interface인가 type alias인가?
4. 무엇을 extends / intersection 하는가?
5. 이 프로젝트에서 정의된 custom prop source는 무엇인가?
6. custom props의 이름과 타입은 무엇인가?
7. 타입이 literal union이면 허용 값은 무엇인가?
8. optional인가?
9. default value가 있는가? 타입에 없으면 구현 destructure를 본다.

내부에서만 쓰는 값은 public prop이 아니다. JSDoc은 답이 아니다.

## Prop 출처

custom vs native는 이름이 아니라 **heritage source**로 나눈다.

- `React.ButtonHTMLAttributes<HTMLButtonElement>` → native / external
- 프로젝트 내부 props type → custom / internal

native는 펼치지 않는다. `expanded: false`로 source만 남긴다. declared/resolved 상세는 custom만 본다.

따라가다가 리터럴이 안 나오면 추측하지 않는다. declared는 남기고, resolved는 TypeScript가 준 결과만 적는다.

## 추출 전략

1. **Syntax extraction** — 코드에 어떻게 선언되어 있는가
2. **Resolved type extraction** — TypeScript가 최종적으로 어떤 타입으로 이해하는가

recipe/CSS DSL을 직접 이해하지 않는다. TypeScript가 resolve한 최종 타입만 쓴다. `RecipeVariants<typeof btn>` 따라가기는 checker의 일이다.

prop RAW 필드:

- `declaredType`: 소스에 적힌 그대로
- `resolvedType` / `values`: type checker 결과
- `optional`: syntax의 `?`
- `default`: 타입에 없고 구현 destructure에 있으면 거기서
- `undefined`는 optional의 TS 표기다. `values`에는 넣지 않는다

checker가 union을 못 풀면 `values`를 비우고 `resolvedType`만 적는다. 그게 사실이다.

## RAW 규칙

넣는다: export 이름, declared/resolved 타입, optional, union values, 런타임 default, 출처, 구현 usage evidence.

넣지 않는다: 설명, 용도, JSDoc, checker가 안 준 union, recipe DSL 재해석, "spinner를 표시한다" 같은 해석.

```
RAW
├── declaration evidence    type / values / optional
├── implementation evidence default / usage
└── provenance              source
```

`usage`는 AST가 본 그대로다.

- `prop ? A : B` → `kind: conditional`
- `prop && A` → `kind: logical-condition`

parent를 타고 `context: jsx | expression`을 붙인다.

Knowledge transformer는 prop 이름이 아니라 `context`만 본다.

- `jsx` → `behavior.kind: conditional-render`
- `expression` → `behavior.kind: conditional-logic`

모르면 비운다. 추측해서 채우는 순간 Extraction이 LLM이 된다.

## Context

핵심은 모델이 판단하는 데 필요한 정보를 어떤 구조로 조립해 제공할 것인가다.

RAW는 모든 evidence다. LLM에 RAW 전체나 소스코드 원문을 던지지 않는다. Context Builder가 고른 KnowledgeInput만 준다.

| RAW | KnowledgeInput |
| --- | --- |
| `declaredType` | 버림. 최종 타입이 필요함 |
| `resolvedType` | `type` |
| `values` / `defaultValue` | 그대로 |
| `optional` | Knowledge에 넣음 |
| `nativeProps.name` / `expanded` | 버림 |
| `nativeProps.source` | `nativeProps: string[]` |
| `raw.source` + prop `source` | `sources`로 모아 중복 제거 |

디버깅은 층으로 가른다.

- RAW가 틀리면 extractor 문제
- KnowledgeInput이 빠지거나 중복이면 Context Builder 문제
- Knowledge가 RAW에 없는 값을 가지면 LLM 문제

`summary` / `description`은 optional이다. LLM이 없어도 Knowledge는 유효하다.

Agent가 "Button allowed variant?"를 물으면 Markdown 전체가 아니라 JSON의 `values`만 context로 줄 수 있다.

## 소스 레이아웃

| 경로 | 역할 |
| --- | --- |
| `src/extractor/` | ts-morph 탐색. 사실만. target project를 연다 |
| `src/knowledge/` | deterministic Knowledge, Markdown renderer, optional LLM enrichment |
| `src/llm/` | `LlmClient`. 모델 구현은 아직 없음 |
| `src/schema/` | RAW / Generation / Knowledge zod 계약 |
| `src/cli.ts` | 공개 CLI entry |
| `tests/` | 추출·검색·검증 결과가 계약과 같은지 |

## 현재 범위

v0.1은 Level 1 API Facts와, usage evidence가 있을 때의 structured behavior까지다.

Runtime validation은 선택이다. Browser Tool의 첫 harness는 Storybook이다. Playwright는 optional dependency다. Observation은 renderChanged와 HTML boolean attribute만 본다. visibility는 아직 없다.

Level 3 Usage Rules와 의미 검색은 이후 단계다.
