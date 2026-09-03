# ArchSync
```
                    현실의 Code
                        │
                        ▼
                 ┌───────────────┐
                 │ AST Extractor │
                 └───────────────┘
                        │
                        ▼
                       RAW
                   "무엇을 봤는가?"
                        │
                        ▼
                 ┌─────────────┐
                 │ Transformer │
                 └─────────────┘
                        │
                        ▼
                    KNOWLEDGE
                 "이게 무슨 의미인가?"
                        │
                        ▼
                ┌────────────────┐
                │ Pattern Engine │
                └────────────────┘
                        │
                        ▼
                   CONVENTION
                "우리 프로젝트는 보통
                   어떻게 하는가?"
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
          Validator              Agent
          "어겼는가?"          "어떻게 작업할까?"
              │                   │
              └─────────┬─────────┘
                        ▼
                      Code
                        │
                        └──────→ 다시 Extract
```
| Layer | 질문 |
|---|---|
| **AST** | 코드가 문법적으로 어떻게 생겼지? |
| **RAW Usage** | 코드에서 실제로 뭘 관찰했지? |
| **Knowledge** | 그 관찰은 개발 관점에서 무슨 의미지? |
| **Convention** | 이런 의미가 프로젝트에서 어떤 패턴을 이루지? |
| **Validator** | 새 코드가 그 패턴에서 벗어났나? |
| **Agent** | 그 정보를 이용해서 뭘 해야 하지? |


### 1단계: AST - "코드 문법이 이렇게 생겼습니다."
ts-morph는 아래와 같이 표현된다.

```
ConditionalExpression
├── condition
│   └── Identifier("isLoading")
├── whenTrue
│   └── JSXElement("Spinner")
└── whenFalse
    └── Identifier("startIcon")
```

### 2단계: RAW Usage - "extractor로 AST에서 필요한 사실만 뽑습니다."
관찰 사실을 의미한다. 

```
{
  "prop": "isLoading",
  "kind": "conditional",
  "context": "jsx"
}
```

### 3단계: Knowledge - 관찰 사실에서 한 단계 의미를 올린다.
AST를 몰라도 읽을 수 있다.

```
{
  "target": "isLoading",
  "behavior": "conditional-render"
}
```
isLoading은 렌더링 결과를 조건부로 바꾸는 prop이다.

##### Knowledge
코드에서 관찰한 사실들을, 다른 프로그램이나 AI가 "이 코드베이스는 이렇게 동작한다"고 이해할 수 있는 형태로 바꾼 데이터.
곧 Agent에게 제공할 노이즈가 섞이지 않은 고품질 Context
(코드 자체도, AST도, 컨벤션도 아님)

