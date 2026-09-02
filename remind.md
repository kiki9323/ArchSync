# ArchSync

ArchSync의 핵심은 AI가 아니라, 코드베이스를 분석해서 에이전트가 잘 이해하고 쓸 수 있는 **최신 Context / Knowledge**를 만드는 것이다.

```
                  Codebase
                     ↓
              Static Extraction
                     ↓
               RAW Evidence
                     ↓
          Knowledge Construction
                     ↓
          ┌──────────┴──────────┐
          ↓                     ↓
    structured JSON        AI-friendly docs
          │                     │
          └──────────┬──────────┘
                     ↓
              Context Provider
                     ↓
          ┌──────────┼──────────┐
          ↓          ↓          ↓
       Claude      Cursor      Agent
```

에이전트는 소스 전체를 다시 읽지 않는다. Context Provider가 Knowledge를 조회하게 한 뒤 이 일을 한다.

- "컴포넌트 만들어"
- "테스트해"
- "컨벤션 검사해"
- "디자인 시스템에 맞아?"

신뢰의 조건: Knowledge는 RAW 사실의 부분집합이다.  
코드에서 **사실만** 뽑아 RAW로 고정하고, LLM은 그 위에 의미만 얹는다.  
Knowledge가 RAW에 없는 값을 가지면 LLM 문제다.

지금은 Level 1 API Facts가 artifact로 나온 단계다. Level 2 Semantics가 다음이고, Level 3 Usage Rules는 Button.md에서 추론하지 않는다.

## 파이프라인

```
TARGET PROJECT       deeps-www (tsconfig, node_modules, source)
    │
    ├─ Syntax (AST)          코드에 어떻게 선언되어 있는가
    └─ Type Checker          TypeScript가 최종적으로 어떤 타입으로 이해하는가
    │
    ▼
EXTRACTION LAYER     사실만 추출 (의미·설명·추론 금지)
    ▼
RAW JSON             {target}/.knowledge/raw/components/Button.json
    ▼
DETERMINISTIC KNOWLEDGE   createComponentKnowledge — LLM 없음
    ▼
JSON                 {target}/.knowledge/components/Button.json     SSOT
    ▼
Markdown Renderer    {target}/.knowledge/components/Button.md      AI/사람용 표현
    │
    ├───────────────┐
    ▼               ▼
CLI            Agent Tool

Optional:
Knowledge → LLM enrichment → summary / description
```

예시: RAW `variant`가 `primary | secondary`인데 Knowledge에 `tertiary`가 있으면 LLM 오류다.

## Target

ArchSync는 컴포넌트를 복붙해서 자체 tsconfig로 돌리지 않는다.  
대상 프론트 프로젝트의 TypeScript 환경을 그대로 쓴다.

```
ArchSync CLI
    ↓
--project deeps-www
    ↓
deeps-www/tsconfig.json
deeps-www/node_modules
deeps-www/src/...
    ↓
TypeScript가 실제 타입 resolve
    ↓
variant: filled | outline | ghost | underline
```

루트 `tsconfig`는 ArchSync CLI 본체(`src/`, `tests/`)용이다. `nodenext`, jsx 없음.  
추출용 program은 target의 tsconfig를 연다. compiler options뿐 아니라 tsconfig에 포함된 source file도 그대로 넣는다. `skipAddingFilesFromTsConfig`는 쓰지 않는다.

## 로드맵

### 완료

```
SOURCE → EXTRACT → RAW ✅
                 → CONTEXT BUILDER ✅
                 → KNOWLEDGE PIPELINE ✅ Mock까지
```

파이프라인 입구는 있다. 지금은 **LLM 없이 Knowledge JSON + Markdown artifact**를 만든다.

### 지금부터

```
Level 1 API Facts ✅          Button.json / Button.md
 ↓
Level 2 Component Semantics   ← 다음
 ↓
Level 3 Usage Rules           Convention Knowledge. Button.md에서 추론 금지
 ↓
Agent Tool / Validation / Agent Loop
```

다음 질문은 API가 아니다.

> Button RAW를 어떤 형태의 AI-friendly Knowledge로 만들어야 Claude Code / Cursor가 최소 context로 잘 사용할까?

이걸 잡으면 ArchSync 정체성이 확실해진다. 실제 OpenAI 연동은 format 뒤에 넣어도 늦지 않다.

## Knowledge Levels

Button Knowledge는 한 문서에 모든 걸 욱여넣지 않는다. 세 층이다.

```
Level 1  API Facts              ← 지금. Button.json / Button.md
         type / values / default / optional

Level 2  Component Semantics    ← 다음
         prop 역할, loading 동작, icon 위치, 컴포넌트 기본 역할

Level 3  Usage Rules            ← 그 다음
         variant 선택 기준, 공통 Button 강제, 금지 조합, CTA 스타일
```

Level 1은 코드에서 deterministic하게 나온다. 현재 `Button.md`가 이 층이다.

Level 2는 구현 usage evidence가 있을 때만 붙는 `behavior`다.  
prop 이름을 hardcoding하지 않는다. RAW에 나온 이름을 구현부에서 추적하고, evidence가 있으면 넣고 없으면 생략한다. `isLoading`이든 `tone`이든 `loading`이든 같다.

Level 3는 컨벤션·디자인 시스템 규칙이다. **Button.md에서 억지로 추론하지 않는다.**  
"CTA는 filled를 쓴다"는 `variant` union에 없고, 컴포넌트 파일만 봐서는 사실이 아니다. 별도 Convention Knowledge 소스가 필요하다.

에이전트 작업과 층의 대응:

| 질문 | 층 |
|---|---|
| allowed values / default가 뭐야? | Level 1 |
| loading일 때 아이콘은? | Level 2 |
| 새 Button을 만들어도 돼? CTA는 어떤 variant? | Level 3 |

## 현재 단계

Level 1 API Facts. `deeps-www/.knowledge/components/Button.md`가 그 산출물이다.

## Extractor가 답하는 질문 (v0.1)

1. 이 파일에 `Button`이라는 exported component가 있는가?
2. 이 컴포넌트가 사용하는 props type은 무엇인가?
3. 그 타입은 interface인가 type alias인가?
4. 무엇을 extends / intersection 하고 있는가?
5. 그중 이 프로젝트에서 정의된 custom prop source는 무엇인가?
6. custom props 각각의 이름과 타입은 무엇인가?
7. 타입이 literal union이면 허용 값은 무엇인가?
8. optional인가?
9. default value가 있는가? (타입에 없으면 구현 destructure를 본다)

내부에서만 쓰는 값(`iconPosition`)은 public prop이 아니다.  
JSDoc은 답이 아니다.

## Prop 출처 분류

custom vs native는 이름 감이 아니라 **heritage source**로 나눈다.

- `React.ButtonHTMLAttributes<HTMLButtonElement>` → native / external
- `CommonButtonProps` → custom / internal (design-system)

native는 펼치지 않는다. `expanded: false`로 source만 남긴다. declared/resolved 상세는 custom만 본다.

```json
{
  "component": "Button",
  "props": {
    "custom": [
      "variant",
      "size",
      "color",
      "fullWidth",
      "rounded",
      "isLoading",
      "startIcon",
      "endIcon"
    ],
    "native": {
      "source": "React.ButtonHTMLAttributes<HTMLButtonElement>",
      "expanded": false
    }
  }
}
```

`custom` 배열은 인덱스다. 각 항목의 declared/resolved/values/default는 아래 prop 객체가 담당한다.

따라가다가 리터럴이 안 나오면 추측하지 않는다. declared는 남기고, resolved는 TypeScript가 준 결과만 적는다.

## 추출 전략 두 개

1. **Syntax extraction** — 코드에 어떻게 선언되어 있는가
2. **Resolved type extraction** — TypeScript가 최종적으로 어떤 타입으로 이해하는가

bad: vanilla-extract `recipe()` 문법을 ArchSync가 직접 이해한다.  
better: TypeScript가 resolve한 최종 타입을 쓴다.

`RecipeVariants<typeof btn>` 따라가기는 checker의 일이다. extractor는 `getType()` 결과를 기록할 뿐, recipe AST를 재구현하지 않는다.

prop RAW 예:

```json
{
  "name": "variant",
  "declaredType": "ButtonVariants['variant']",
  "resolvedType": "\"filled\" | \"outline\" | \"ghost\" | \"underline\" | undefined",
  "values": ["filled", "outline", "ghost", "underline"],
  "optional": true,
  "default": "filled",
  "source": "src/components/ui/button/button.types.ts"
}
```

- `declaredType`: syntax. 소스에 적힌 그대로
- `resolvedType` / `values`: type checker. TS가 이해한 최종 타입
- `optional`: syntax의 `?`
- `default`: 타입에 없고 구현 destructure에 있으면 거기서
- `undefined`는 optional의 TS 표기다. `values`에는 넣지 않는다

checker가 union을 못 풀면 `values`를 비우고 `resolvedType`만 적는다. 예: `color`는 `Object.keys(colorVars)` + `Record<string, any>`라서 리터럴이 아니라 `string`으로 풀릴 수 있다. 그게 사실이다.

## 폴더

| 경로                           | 역할                                                    |
| ------------------------------ | ------------------------------------------------------- |
| `src/extractor/`               | ts-morph 탐색. 사실만. target project를 연다            |
| `src/knowledge/`               | deterministic Knowledge, Markdown renderer, optional LLM enrichment |
| `src/llm/`                     | `LlmClient`. 모델 구현은 아직 없음                                  |
| `src/schema/`                  | RAW / Generation / Knowledge zod 계약                               |
| `{target}/.knowledge/raw/components/` | 컴포넌트 RAW. ArchSync workspace가 아니라 대상 프로젝트 |
| `{target}/.knowledge/components/`     | `Button.json` SSOT, `Button.md` 렌더 결과              |
| `tests/`                       | 추출 결과가 코드와 같은지                               |

지금은 단일 패키지다. `pnpm-workspace.yaml`은 두지 않는다.

RAW는 `.knowledge/raw/components/`부터 쌓는다. 나중에 `tokens/`, `routes/`, `imports/`, `patterns/`로 늘린다.

## RAW 규칙

넣는다: export 이름, declared/resolved 타입, optional, union values, 런타임 default, 출처.

넣지 않는다: 설명, 용도, JSDoc, checker가 안 준 union, recipe DSL 재해석.

모르면 비운다. 추측해서 채우는 순간 Extraction이 LLM이 된다.

## Button이 보여주는 함정

1차 대상은 deeps-www `src/components/ui/button/`.

주석과 코드가 어긋난다. RAW는 주석이 아니라 checker 결과다.

- `variant`: filled \| outline \| ghost \| **underline**
- `color`: checker가 `string`을 주면 `string`이 RAW다
- `state`는 public prop이 아님
- default는 구현 destructure: `filled` / `ghost` / `h40` / `r2`

## Context Engineering

프롬프트를 잘 쓰는 게 전부가 아니다.  
핵심은 **모델이 판단하는 데 필요한 정보를 어떤 구조로 조립해서 제공할 것인가**다.

RAW는 모든 evidence다. LLM에 RAW 전체나 소스코드 원문을 던지지 않는다.

```
RAW
│  모든 evidence
│
├─ declaredType
├─ resolvedType
├─ source
├─ optional
├─ values
└─ defaultValue
        │
        ▼
Context Builder    buildKnowledgeInput()
        │
        ├─ 필요한 사실 선택
        ├─ 중복 제거
        └─ LLM 친화적 형태로 변환
        │
        ▼
createComponentKnowledge()     LLM 없이 유효한 Knowledge
        │
        ├─ JSON SSOT
        └─ Markdown Renderer   AI-consumable artifact

Optional:
Knowledge → LLM enrichment → summary / description
```

이 계층이 있어서 디버깅이 갈린다.

- RAW가 틀리면 extractor 문제
- KnowledgeInput이 빠지거나 중복이면 Context Builder 문제
- Knowledge가 RAW에 없는 값을 가지면 LLM 문제

### Context Builder가 하는 일

| RAW                             | KnowledgeInput                               |
| ------------------------------- | -------------------------------------------- |
| `declaredType`                  | 버림. LLM은 선언 문법보다 최종 타입이 필요함 |
| `resolvedType`                  | `type`                                       |
| `values` / `defaultValue`       | 그대로                                       |
| `optional`                      | Knowledge에 넣음. RAW 확정 fact              |
| `nativeProps.name` / `expanded` | 버림                                         |
| `nativeProps.source`            | `nativeProps: string[]`                      |
| `raw.source` + prop `source`    | `sources`로 모아 중복 제거                   |

Knowledge JSON은 SSOT다. Markdown은 사람/AI context용 렌더 결과이지 SSOT가 아니다.

```
{target}/.knowledge/          예: deeps-www/.knowledge/
├── raw/components/Button.json
└── components/
    ├── Button.json    ← structured knowledge
    └── Button.md      ← rendered representation
```

출력은 ArchSync workspace가 아니라 **대상 프로젝트 루트**다. Claude Code / Cursor가 그 프로젝트에서 `.knowledge`를 바로 읽는다.

Agent가 "Button allowed variant?"를 물으면 Markdown 전체가 아니라 JSON의 `values`만 context로 줄 수 있다.

`summary` / `description`은 optional이다. LLM이 없어도 Knowledge는 유효하다. `generateComponentKnowledge()`는 그 위에 의미를 얹는 enrichment다.
