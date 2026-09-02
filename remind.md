# ArchSync

ArchSync는 AI가 프론트엔드 코드베이스의 구조와 규칙을 **신뢰할 수 있는 형태**로 조회하게 해주는 Knowledge Tool이다.

에이전트는 소스 전체를 다시 읽지 않는다. Knowledge Layer를 tool call로 조회한다.

```
Codebase
   ↓
ArchSync Knowledge Layer     RAW → Context → KNOWLEDGE
   ↑
   │ tool call
Claude Code / Cursor / Agent
```

신뢰의 조건: Knowledge는 RAW 사실의 부분집합이다.  
코드에서 **사실만** 뽑아 RAW로 고정하고, LLM은 그 위에 의미만 얹는다.  
Knowledge가 RAW에 없는 값을 가지면 LLM 문제다.

지금은 Knowledge를 쌓는 단계다. tool call 인터페이스는 아직 아니다.

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
RAW JSON             .knowledge/raw/components/Button.json
    ▼
Context Builder      buildKnowledgeInput — 필요한 사실만 조립
    ▼
KnowledgeInput       .knowledge/input/components/Button.json
    ▼
Prompt + LlmClient   의미만 생성 (ComponentKnowledgeGeneration)
    ▼
merge                RAW facts + LLM semantics
    ▼
KNOWLEDGE            ComponentKnowledgeSchema
    ▼
VALIDATION           Knowledge ⊆ RAW 사실
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

## 현재 단계

```
ComponentRaw → KnowledgeInput → Prompt → LlmClient → merge → KNOWLEDGE
```

OpenAI/Claude SDK는 아직 붙이지 않는다. `LlmClient` 경계와 Mock으로 파이프라인만 고정한다.

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
| `src/knowledge/`               | Context Builder, prompt, RAW facts + LLM semantics merge |
| `src/llm/`                     | `LlmClient`. 모델 구현은 아직 없음                       |
| `src/schema/`                  | RAW / Generation / Knowledge zod 계약                    |
| `.knowledge/raw/components/`   | 컴포넌트 RAW                                            |
| `.knowledge/input/components/` | LLM에 넘길 KnowledgeInput                               |
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
KnowledgeInput
        │
        ▼
Prompt + LlmClient     summary / description 만
        │
        ├──────────── RAW facts (type, values, default, sources)
        │
        ▼
KNOWLEDGE
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
| `optional`                      | 아직 안 넣음. `type`의 `undefined`와 겹침    |
| `nativeProps.name` / `expanded` | 버림                                         |
| `nativeProps.source`            | `nativeProps: string[]`                      |
| `raw.source` + prop `source`    | `sources`로 모아 중복 제거                   |

Knowledge는 RAW 사실과 LLM 의미를 합친 문서다.

```
RAW facts ─────────────────────┐
                              │
                              ▼
                          KNOWLEDGE
                              ▲
                              │
LLM semantics ────────────────┘
```

두 스키마를 섞지 않는다.

| 스키마                               | 역할                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| `ComponentKnowledgeGenerationSchema` | LLM이 생성할 수 있는 영역. `summary` + prop `description`만 |
| `ComponentKnowledgeSchema`           | 최종 ArchSync knowledge. facts + semantics                  |

`type` / `values` / `defaultValue` / `sources`는 LLM output을 믿지 않는다. KnowledgeInput에서 가져온다. LLM이 `invented` prop을 만들어도 merge는 `input.props`만 순회하므로 최종 Knowledge에 안 들어간다.

`LlmClient`만 knowledge pipeline이 안다. OpenAI / Claude / Mock은 adapter다.
