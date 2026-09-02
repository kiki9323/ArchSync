# ArchSync

코드에서 **사실만** 뽑아 RAW로 고정하고, LLM은 그 위에 의미만 얹는다.  
Knowledge가 RAW에 없는 값을 가지면 LLM 문제다.

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
LLM                  의미 / 설명 / 추론
    ▼
KNOWLEDGE → VALIDATION     Knowledge ⊆ RAW 사실
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
deeps-www Button.tsx → AST + Type Checker → Extraction → Button.json
```

LLM / Knowledge / Validation은 아직 안 한다.

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

| 경로 | 역할 |
|---|---|
| `src/extractor/` | ts-morph 탐색. 사실만. target project를 연다 |
| `src/schema/` | RAW JSON zod 계약 |
| `.knowledge/raw/components/` | 컴포넌트 RAW |
| `tests/` | 추출 결과가 코드와 같은지 |

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

## Knowledge / Validation (나중)

Knowledge: RAW 사실 위의 의미·설명.

Validation: Knowledge가 RAW에 없는 이름/값을 추가했는지 검사.
