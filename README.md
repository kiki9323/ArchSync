# ArchSync

ArchSync는 AI가 프론트엔드 프로젝트 규칙을 매번 다시 읽지 않아도 되게 만드는 보조 계층입니다.

컴포넌트를 대신 발명하는 생성기가 아닙니다. 이미 코드에 있는 공통 UI API를 Knowledge로 고정하고, Coding Agent가 그 계약 안에서 구현·수정·검증하게 합니다.

팀이 커질수록 반복되는 비용은 같습니다. 새 개발자, AI Agent, PR 리뷰, QA, 디자인 시스템 변경마다 `Button`의 variant와 size를 다시 설명하는 일입니다. ArchSync의 가치는 그 설명을 Knowledge 조회로 바꾸는 데 있습니다.

```
Source
  → Sync
  → Knowledge JSON (SSOT)
      → Search / Context
      → Implement
      → Validate
```

## 목표

기존 방식은 프롬프트에 프로젝트 규칙을 매번 넣습니다.

```text
우리 Button은 filled/outline이고
size는 h48을 쓰고
이 파일 구조에서는 ...
```

ArchSync를 쓰면 요청만 남깁니다.

```text
/archsync 이 화면 CTA 추가해줘
```

Agent는 필요한 규칙을 직접 조회합니다. 긴 convention 문서를 먼저 읽힐 필요가 줄어듭니다.

전형적인 장면은 다음과 같습니다.

```text
디자이너  저장 CTA는 기존 공통 버튼을 써 주세요.
개발자    /archsync 저장 버튼 추가해줘
Agent     검색 → Button Knowledge 조회 → 구현 → validate
개발자    결과만 확인하고 PR
```

## 사용 시나리오

| 상황             | 요청 예                                                       | Agent가 하는 일                                                                    |
| ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 새 UI 추가       | `/archsync 저장 버튼 추가해줘`                                | 관련 컴포넌트를 찾고 최신 variant/size/behavior로 구현한 뒤 검증합니다.            |
| 기존 코드 수정   | `/archsync 이 Button을 링크 버튼으로 바꿔줘`                  | Button과 LinkButton Knowledge를 함께 보고 프로젝트 규칙에 맞게 교체합니다.         |
| 잘못된 요청 방어 | `/archsync variant를 primary로 바꿔줘`                        | Knowledge에 없는 값은 만들지 않습니다. 허용값을 근거로 수정하거나 충돌을 알립니다. |
| 사용처 정리      | `/archsync 이 페이지의 버튼 사용을 공통 규칙에 맞춰 정리해줘` | 사용처를 검사하고 위반만 골라 수정합니다.                                          |
| 신규 합류 / AI   | `/archsync 로그인 화면 만들어줘`                              | 관련 Knowledge를 찾아 기존 컴포넌트 API를 재사용합니다.                            |

이후 단계에서 커지는 가치:

- 디자인 시스템 변경 후 sync하면, 다음 Agent 요청부터 새 규칙을 사용합니다. 오래된 문서를 참고하는 문제를 줄입니다.
- 구현 직후 validate로 잘못된 prop을 먼저 걷어내면, QA는 기계적으로 잡을 수 있는 오류가 빠진 상태로 시작합니다.
- CI에 연결하면 PR 리뷰 전에 위반 건수를 표시할 수 있습니다.

현재 0.1.0은 명시적 `/archsync` 요청, Knowledge 조회, static validation, incremental sync/watch, 통합 CLI, CI 예시까지입니다.

## 전제

ArchSync는 공통 UI를 새로 설계하지 않습니다. 디자인 시스템이나 공유 컴포넌트가 이미 코드로 있는 프론트엔드에서 동작합니다.

잘 맞는 경우:

- `Button`, `Modal`처럼 팀이 재사용하는 공통 컴포넌트가 있습니다.
- props와 허용 값이 TypeScript로 읽힙니다.
- 화면 구현은 그 공통 컴포넌트를 조합하는 일입니다.

잘 맞지 않는 경우:

- 화면마다 one-off UI만 있고 공유 레이어가 없습니다.
- 공통 컴포넌트 없이 Agent가 UI를 처음부터 만들기를 기대합니다.

공통 UI가 없으면 Sync할 SSOT도, Search할 대상도, Validate할 계약도 거의 없습니다.

## 구성

사용할 때는 아래 세 가지가 함께 있어야 합니다.

| 구성 요소           | 역할                                               |
| ------------------- | -------------------------------------------------- |
| ArchSync 저장소     | Knowledge 생성, MCP 서버, slash command 원본       |
| 프론트엔드 프로젝트 | `.knowledge` 산출물. Agent가 실제로 읽는 대상      |
| Coding Agent        | ArchSync MCP 등록. Cursor / Codex / Claude Code 등 |

`.cursor/commands/archsync.md`만 공유하는 것으로는 부족합니다. 그 파일은 `/archsync` 입력 시 Agent에게 전달되는 작업 지시입니다. 조회와 검증은 MCP 서버가 수행하고, 규칙은 프론트엔드 프로젝트의 Knowledge JSON에서 읽습니다.

## 버전

**0.1.0**은 React/TypeScript 컴포넌트에서 Knowledge를 추출하고, 이를 AI context와 static/runtime validation에 재사용하는 첫 공개 버전입니다.

1.0 이전이라 CLI·스키마·artifact 형태가 breaking 변경될 수 있습니다. 프로덕션 CI에 넣을 때는 버전을 pin 하세요 (`archsync-fe@0.1.0`).

이후 버전:

- 0.2.x — report 개선, CI / PR check
- 0.3.x — fix suggestion, Storybook addon
- 0.4.x — architecture / dependency rules

변경 목록은 [CHANGELOG.md](CHANGELOG.md)를 봅니다.

## 설치

프론트엔드 프로젝트에서 CLI로 쓰는 경로를 기준으로 합니다.

npm의 기존 [`archsync`](https://www.npmjs.com/package/archsync)는 다른 프로젝트입니다. 패키지 이름은 `archsync-fe`이고, CLI bin은 `archsync`입니다.

### npm (권장, publish 이후)

```bash
# frontend repo
pnpm add -D archsync-fe@^0.1.0

pnpm exec archsync sync --project .
pnpm exec archsync search "저장 버튼"
pnpm exec archsync context Button
pnpm exec archsync check Button --format text
pnpm exec archsync validate --component Button --format json
pnpm exec archsync watch --project .
```

`pnpm exec archsync <command>`는 frontend 루트에서 실행합니다. `--project` 기본값은 `.`입니다.

### Git / 로컬 개발

소스는 비공개 저장소에 둘 수 있습니다. 접근 권한이 있는 경우에만 clone 됩니다.

```bash
git clone git@github.com:kiki9323/ArchSync.git archsync
cd archsync
pnpm install
pnpm build
```

개발 중에는 빌드 없이 실행할 수 있습니다.

```bash
pnpm archsync sync --project /absolute/path/to/your-frontend
# 또는
pnpm exec tsx src/cli.ts sync --project /absolute/path/to/your-frontend
```

프론트엔드 저장소 안에 ArchSync 소스를 넣을 필요는 없습니다.

## Knowledge 생성

Knowledge는 프론트엔드 프로젝트 루트에 기록됩니다. MCP와 CLI의 `projectPath`/`--project`도 항상 이 경로를 가리켜야 합니다.

```bash
npx archsync sync --project .
```

기본 탐색 범위는 `src/components/ui`와 `src/components/shared`입니다. 변경이 필요하면 프론트엔드 루트에 `archsync.config.json`을 둡니다.

```json
{
  "componentRoots": ["src/components/ui", "src/components/shared"],
  "componentAliases": {
    "Button": ["button", "버튼", "cta"],
    "LinkButton": ["link button", "링크 버튼"]
  }
}
```

`componentRoots`는 추출 범위입니다. `componentAliases`는 검색 어휘만 보완합니다. variant와 size 같은 제품 규칙은 Knowledge SSOT에서 읽습니다.

생성 결과:

```text
.knowledge/components/Button.json       # Agent와 Validator의 SSOT
.knowledge/raw/components/Button.json   # 추출 evidence (cache)
.knowledge/manifest.json                # incremental sync metadata (생성물)
```

`npx archsync sync`는 incremental입니다. fingerprint가 같은 component는 extraction을 건너뜁니다.
component source나 직접 local type dependency가 바뀌면 해당 component만 다시 추출합니다.

파일 변경을 계속 반영하려면:

```bash
npx archsync watch --project .
```

watch는 incremental sync API만 호출합니다. validation을 자동 실행하지는 않습니다.

Markdown docs는 Knowledge SSOT가 아닙니다. on-demand로만 렌더합니다.

```bash
pnpm exec archsync docs Button --project .
```

사람이 읽는 validation report:

```bash
pnpm exec archsync check Button --project . --format text
pnpm exec archsync check Button --project . --format markdown
pnpm exec archsync check Button --project . --format markdown --output archsync-report.md
```

`--format markdown` 출력은 GitHub Step Summary에 붙이기 좋습니다. report는 ephemeral이며 Knowledge SSOT가 아닙니다.

`.knowledge/components`가 없으면 검색과 검증은 `no-match` 또는 `missing`을 반환합니다. MCP를 연결하기 전에 sync를 먼저 실행해야 합니다.

## CI 예시

PR에서 Knowledge sync + validate를 돌리는 최소 템플릿은 저장소에 있습니다.

```text
examples/github-actions/archsync.yml
```

프론트엔드 레포에 `.github/workflows/archsync.yml`로 복사한 뒤, 검증할 component를 팀 기준으로 늘리면 됩니다.

현재 v0.1은 sync/watch/validate CLI와 예시 workflow까지 제공합니다. 강제 merge gate 정책은 팀에서 설정합니다.

## MCP 등록

클라이언트별 설정 형식은 다르지만, 실행하는 서버는 같습니다.

```bash
npx archsync-fe mcp
# 또는 개발 중
pnpm archsync mcp
```

stdio 기반 MCP 서버입니다.

노출되는 tool:

- `archsync_search_context`
- `archsync_get_component_context`
- `archsync_validate`

### Cursor

Settings → MCP에 추가하거나, 사용자/프로젝트 `mcp.json`에 등록합니다.

```json
{
  "mcpServers": {
    "archsync": {
      "command": "npx",
      "args": ["archsync-fe", "mcp"]
    }
  }
}
```

publish 전이면 ArchSync checkout에서 `pnpm --dir /absolute/path/to/archsync archsync mcp`를 사용합니다.

등록 후 Cursor를 다시 열고, Agent 도구 목록에 위 세 tool이 보이는지 확인합니다.

### Codex

```bash
codex mcp add archsync -- npx archsync-fe mcp

codex mcp get archsync
```

Codex는 `~/.codex/config.toml`을 사용합니다. Cursor의 `mcp.json`과 공유되지 않습니다.

### Claude Code

프로젝트 또는 사용자 MCP 설정에 동일한 `npx archsync-fe mcp` 명령을 등록합니다.

## Slash command

MCP만 등록되어 있어도 Agent에게 tool을 직접 요청할 수 있습니다. `/archsync`로 짧게 실행하려면 프론트엔드 프로젝트 또는 Cursor workspace에 command 파일을 복사합니다.

```text
.cursor/commands/archsync.md
```

원본 위치는 `archsync/.cursor/commands/archsync.md`입니다.

이 파일에는 특정 제품의 variant나 size를 넣지 않습니다. Agent가 MCP로 Knowledge를 조회하도록 흐름만 정의합니다.

| Agent        | 경로                                               |
| ------------ | -------------------------------------------------- |
| Cursor skill | `archsync/.cursor/skills/archsync/SKILL.md`        |
| Claude Code  | `archsync/.claude/commands/archsync.md`            |
| Codex        | `archsync/adapters/codex/skills/archsync/SKILL.md` |

## 사용 흐름

1. `npx archsync-fe sync --project .`로 Knowledge를 생성합니다.
2. Coding Agent에 ArchSync MCP가 등록되어 있는지 확인합니다.
3. 필요하면 `.cursor/commands/archsync.md`를 복사합니다.
4. 프론트엔드 프로젝트에서 요청합니다.

```text
/archsync 저장 버튼 추가해줘
```

Agent는 다음 순서를 따릅니다.

1. `archsync_search_context`로 후보를 찾습니다.
2. `archsync_get_component_context`로 허용 값, default, behavior를 조회합니다.
3. Knowledge에 있는 값만 사용해 구현합니다.
4. `archsync_validate`로 변경 파일을 검사합니다.
5. `failed`이면 violation evidence를 기준으로 수정한 뒤 다시 검증합니다.

`projectPath`는 ArchSync 저장소가 아니라, `.knowledge`가 생성된 프론트엔드 루트입니다.

검색은 컴포넌트 이름과 Knowledge에 명시된 alias만 사용합니다. alias가 있으면 `저장 버튼` 같은 업무 표현도 매칭됩니다. 의미 추론은 하지 않습니다.

## CLI

공식 entrypoint는 `archsync` bin입니다.

```bash
pnpm exec archsync sync --project .
pnpm exec archsync watch --project .
pnpm exec archsync search "저장 버튼"
pnpm exec archsync context Button
pnpm exec archsync check Button --format text
pnpm exec archsync validate --component Button --file src/features/example.tsx --format json
pnpm exec archsync docs Button
pnpm exec archsync mcp
pnpm exec archsync help
```

`check`는 사람용 report, `validate`는 structured JSON입니다. 같은 validator를 씁니다.

## 개발

구현·추출·스키마를 바꿀 때는 [`docs/architecture.md`](docs/architecture.md)를 먼저 읽습니다.

```bash
pnpm test:run
pnpm build
pnpm pack:list
pnpm smoke:pack
pnpm archsync help
```

npm 패키지에는 `bin`, `dist`, `examples`, `README.md`, `CHANGELOG.md`, `LICENSE`만 들어갑니다. `src/`, `tests/`, `.knowledge`는 패키지에 넣지 않습니다. 설계 문서는 git 저장소의 `docs/`에 둡니다.

소스 git을 비공개로 두어도 npm public 패키지는 올릴 수 있습니다. 그때 공개되는 것은 tarball 내용이지 GitHub 저장소 전체가 아닙니다.
