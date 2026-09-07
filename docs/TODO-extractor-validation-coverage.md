# Extractor and validation coverage follow-up

This document records unfinished work on `wip/extractor-validation-coverage` so it can be resumed without relying on local audit artifacts.

Do not summarize this branch as `13.75% → 100%` in CHANGELOG, README, or review. That headline is skip-layer only.

## Where the measurement ran

There is no separate ArchSync checkout with extra uncommitted extractor code.

- ArchSync: this repository, commit `cd75d75` (`origin/wip/extractor-validation-coverage`). `src/` was not changed by the measurement. Git status is clean because the run only wrote gitignored files.
- Target: `/Users/melly/git/(2)deeps-www` (same `componentRoots` as the 0.1.0 baseline: `src/components/ui`, `src/components/shared`).
- Local artifacts (gitignored, regenerate if missing): `reports/deeps-www-coverage/`.
- Side effect: that target copy still has `.knowledge/` (159 JSON files). It is not gitignored there. Delete it if the copy should stay clean.

At the time this measurement ran, `src/extractor/` had no `color`-specific handling — that is why `Button.color` was missing: the regression was in the committed extractor, not in a lost working tree. It has since been fixed on this branch; see "Button.color — merge blocker 1 — FIXED" below.

## Reproduced 0.1.0 baseline

Unchanged `deeps-www` copy, same roots:

- discovered: 80
- Knowledge generated: 11
- skipped: 69
- failed: 0
- skip-layer coverage: 11 / 80 = 13.75%

0.1.0 Button validation:

- usages: 140
- checked: 256
- unknown: 124
- violations: 0
- status then: `passed`

Under the current status rules the same aggregate is `partial` (deterministic checks passed, unknowns remain).

## Why the inventory grew (two axes, not one percentage)

Do not mix these into a single “coverage %”. The last review’s objection to `83/159 = 100%` was exactly that: discovery growth and type-resolution growth were flattened into one skip-layer ratio.

### Axis 1 — how props types are read (`resolveComponentProps`)

0.1.0 effectively had one gate after discovery: look in the same file for a local `interface ${componentName}Props`. That is the last fallback in `src/extractor/resolve-component-props.ts`. This branch still keeps it, but only as a safety net.

Current order:

1. The implementation’s first parameter type annotation
2. Else the inferred parameter type (e.g. contextual `React.FC<{...}>`)
3. Else explicit name / `${componentName}Props` (0.1.0’s whole rule)

So 0.1.0 skipped components that *had* props types, just not a local `NameProps` interface:

| Component | Actual props | 0.1.0 looked for | Result then |
| --- | --- | --- | --- |
| `Button` | `interface ButtonProps` | `ButtonProps` | extracted |
| `RefreshButton` | `type Props = { ... }` | `RefreshButtonProps` | skip |
| `TopButton` | `type TopButtonProps` | `getInterface('TopButtonProps')` | skip (type alias, not interface) |
| `ArrowIcon` etc. | imported `IconProps` | `ArrowIconProps` | skip |
| `ContentsItems` | `React.FC<{ items, type }>` | `ContentsItemsProps` | skip |

This branch classifies the annotation instead: interface, type-alias, imported, inline, inferred, component-props, no-props. That is the “type alias and imported props resolution” work on this branch. Named/default JSON 11 → 83 is mostly this axis, not a larger file walk.

### Axis 2 — who is a candidate (`discover-components`)

0.1.0 only considered exported PascalCase JSX functions/variables. `DialogRoot` is not exported; it is only referenced as:

```ts
export const Dialog = { Root: DialogRoot, Popup: DialogPopup };
```

`src/sync/discover-components.ts` (“Public compound APIs”, the object-literal walk) now adds those members as candidates. That is why the inventory grows again 83 → 159. Compound JSON often has zero custom props: `React.ComponentProps<typeof Base*.*>` stays unexpanded native evidence (64 empty shells, almost all `component-props`).

Compound *usage* matching (`<Dialog.Root>` → `DialogRoot` Knowledge) is a third, later fix in the validator. Discovery can write member JSON and still report usages 0 until that matching exists. See “Compound JSX member matching” below.

## Honest after numbers (this branch vs that target)

Skip-layer means “Knowledge JSON was written”, including empty custom-prop documents.

| Inventory | discovered | JSON written | skipped | failed | skip-layer |
| --- | --- | --- | --- | --- | --- |
| named/default export (0.1.0-style) | 83 | 83 | 0 | 0 | 83 / 83 |
| plus compound members | 159 | 159 | 0 | 0 | 159 / 159 |

The named/default denominator grew 80 → 83. Do not force `/ 80` without the original name list.

Custom-prop Knowledge (≥1 custom prop). Empty JSON is not an agent-usable contract:

| Inventory | with custom props | empty custom props |
| --- | --- | --- |
| named/default 83 | 79 | 4 (`Updated`, `CookieBanner`, `DpIcon`, `PpIcon`) |
| compound 76 | 16 | 60 |
| all 159 | 95 | 64 |

64 empty shells are almost all compound `React.ComponentProps<typeof Base*.*>` members. Mixing 64 with the 83 named/default denominator is wrong. Named/default with any custom prop is 79 / 83, not (83 − 64) / 83.

The 11 → 83 named/default jump is axis 1 (stop requiring a local `NameProps` interface). The 83 → 159 jump is axis 2 (compound members). Import-alias usage validation (`Button as RenamedButton`) is separate from both.

Skip-layer 100% is still not usable-contract coverage. Compound public names (`Dialog`, `Popover`) are not first-class Knowledge. `<Dialog.Root>` usage matching is fixed below; the container-level Knowledge model is still open.

## Button.color — merge blocker 1 — FIXED

0.1.0 Knowledge had `color`. It was missing in the experimental extractor because of two distinct precedence bugs, both in `src/extractor/component.ts`, both now fixed on this branch:

1. **Intersection merge order.** For `Custom & Native` intersection types where both sides declare the same property name, the checker merges them into one transient symbol whose `getDeclarations()` order follows intersection order, not precedence. The extractor took `declarations()[0]` unconditionally, so a native declaration ordered first silently dropped the project's own narrower declaration. Fixed by preferring the first non-external declaration and falling back to an external one only when the project declares nothing.
2. **Interface multi-`extends` shadowing (the real Button case).** `ButtonProps` is `interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, CommonButtonProps {}` — an empty body with two heritage clauses that both declare `color`. Unlike an intersection type, TypeScript does **not** merge this into a multi-declaration symbol at all: `type.getProperties()` returns exactly one declaration for `color`, taken from whichever heritage clause is listed first (`ButtonHTMLAttributes`, native). The project's own `CommonButtonProps.color` was never visible to `symbol.getDeclarations()`, so no amount of reordering that list could have found it. Fixed by walking the interface's own `extends` heritage directly (`findProjectPropertyOverride` in `component.ts`) whenever the checker-resolved property has no project declaration, looking for a same-named property on a non-external heritage interface, and using that declaration's own type instead of the shadowed one.

Verified on real `deeps-www` (`.knowledge` cleared, full re-sync): `Button.json` now has `color: { type: "string | undefined", optional: true, defaultValue: "ghost" }`, matching the 0.1.0 baseline exactly.

Regression tests: `tests/component-props-resolution.test.ts` — 4 cases cover bug 1 (intersection collision in both orders, native-only passthrough unaffected, imported project declaration winning over a native collision) plus a 5th case added after review that reproduces bug 2 directly (`interface X extends Native, Project {}`, empty body, the actual Button.tsx shape) — the intersection cases alone exercise only the `declarations().find` path, not `findProjectPropertyOverride`, so they would not have caught a regression in the heritage-walk fix. Confirmed discriminating by reverting `component.ts` and re-running: the 5th case fails, the other 4 still pass.

`color` has no literal union in this codebase (it is typed as plain `string`, sourced from a recipe/CSS variants type the checker cannot reduce to literals) — recovering it does not turn it into a checkable enum. See the updated Button validation numbers below.

## Compound JSX member matching (`<Dialog.Root>`) — merge blocker 5, partial

`src/validator/validate-component-usage.ts` only matched JSX tags that were a plain `Identifier`. A compound member usage like `<Dialog.Root>` has a `PropertyAccessExpression` tag name, which the old code never inspected — `tag.getSymbol()` on it resolves to the `Root` property of the `Dialog` object, not to the `DialogRoot` implementation, so `resolved.getName() === knowledge.component` (`"Root" === "DialogRoot"`) was always false. That is why measured usages were 0 on every real Dialog/Popover file even though the elements are right there in the source.

Fix, in order of preference:

1. **Structural resolution (primary path).** For a `PropertyAccessExpression` tag, resolve the object identifier's symbol (following import aliases), find its declaration's object-literal composition (`export const Dialog = { Root: DialogRoot, ... }`), locate the property matching the JSX member name, and resolve **that** identifier's declaration. Match it against Knowledge exactly like a plain identifier (source file + name). This needs no naming convention and no `exportName` string at all — it re-derives the real implementation from the real composition AST, so it also resolves import aliases (`import { Dialog as MyDialog } from ...; <MyDialog.Root />`) for free.
2. **Textual fallback.** Only when structural resolution finds nothing (e.g. the object comes from an external/untyped namespace) does the code fall back to comparing `tag.getText()` against a new `ComponentKnowledge.exportName` field — the public JSX path (`"Dialog.Root"`), recorded from the same real export/composition AST `discoverComponents` already walks for compound discovery. It is threaded from `DiscoveredComponent.exportName` into `createComponentKnowledge(raw, { exportName })` in `sync-knowledge.ts`. Nothing is guessed from the implementation name string.

Verified on real `deeps-www` across the four files used for the earlier 0-usage measurement:

| file | DialogRoot | DialogPopup | PopoverPopup |
| --- | --- | --- | --- |
| `dialog.stories.tsx` | 2 usages | 2 usages | 0 |
| `restricted-modal.tsx` | 1 usage | 1 usage (2 unknown props) | 0 |
| `popover.stories.tsx` | 0 | 0 | 19 usages (2 checked) |
| `rank-info-popover.tsx` | 0 | 0 | 1 usage (1 unknown) |

Before the fix all of these were 0. `Knowledge.exportName` now correctly reads `"Dialog.Root"` / `"Dialog.Popup"` / `"Popover.Popup"` after a full re-sync.

Regression tests: `tests/validate-component-usage.test.ts` (`compound member JSX` describe block — direct member match, import-alias member match, no false-positive match on an unrelated object with the same property name, and the textual fallback path).

Marked **partial**, not fully closed: this only makes `<Dialog.Root>` usage *detection* work. It does not address that most compound member Knowledge (`component-props` resolution) has zero custom props to actually check against (see the empty-custom-props table above), and it does not implement alias resolution beyond one level of object-literal composition (deeper re-exports, e.g. re-exporting a member from a different module, are not attempted). The public-container-vs-member Knowledge model decision (item 5/6 in the list below) is unchanged.

## Button validation on this branch (after the color fix)

- usages: 141
- checked: 257
- unknown: 174 (up from 49 — `color`'s 125 usages are now correctly surfaced as `knowledge has no finite values` instead of being silently invisible, plus `startIcon` / `endIcon` / `isLoading` / `fullWidth` / one spread)
- violations: 0
- status: `partial`

Do not read 174 as a regression from 49. 49 was undercounting: with `color` absent from Knowledge, every `color="..."` usage was invisible to the validator (same as an unregistered prop), not "passing". 174 is the honest number for what this Knowledge can and cannot check today.

## Validation matrix (current, not a fix)

- `variant={choice}` → unknown (`dynamic expression`)
- `{...props}` → unknown (`spread attribute`)
- unregistered prop → ignored; only-unregistered usage → `not-checked`
- `color: string` in Knowledge → unknown (`knowledge has no finite values`)
- current Button `color="primary"` → unknown (`knowledge has no finite values`) — previously not-checked/invisible before the color fix above
- `import { Button as RenamedButton }` + invalid literal → checked violation
- `<Dialog.Root>` / `<Popover.Popup>` compound member usage → now counted as a usage (previously invisible, see merge blocker 5 above)

`--strict` does not change status. It only changes exit code when status is not `passed`.

| Case | status | default exit | `--strict` |
| --- | --- | --- | --- |
| deterministic violation | failed | 1 | 1 |
| partial | partial | 0 | 1 |
| not-checked | not-checked | 0 | 1 |
| unknown only | unknown | 0 | 1 |
| fully passed | passed | 0 | 0 |

Real deeps-www `check Button --strict` exits 1 because Button is `partial`. Finite-value-less boolean / `ReactNode` unknowns are intended. Therefore `check --strict` is not a default CI gate for this design system.

## Must finish before merging

1. ~~Fix `Button.color` (heritage, not name).~~ **Done.** Two precedence bugs fixed in `src/extractor/component.ts` (intersection merge order, interface multi-`extends` shadowing). Re-measured on real `deeps-www`: `color` present, matches 0.1.0. See "Button.color — merge blocker 1 — FIXED" above.
2. ~~Stop selling skip-layer 100% as coverage.~~ **Done in README** — `coverage.*` fields are now documented as "Knowledge JSON written, not a percentage of agent-usable contracts."
3. ~~Correct README / CI copy.~~ **Done** — README no longer presents `archsync check Button --strict` as the default PR gate; it points at `examples/github-actions/archsync.yml` (no `--strict`) and explains why `partial` is expected on deeps-www's Button.
4. Close or explicitly accept the unregistered-prop hole (`not-checked` is silent).
5. ~~Decide compound Knowledge: member implementation JSON vs public container vs making `<Dialog.Root>` match.~~ **`<Dialog.Root>` usage detection fixed** (`src/validator/validate-component-usage.ts` + `ComponentKnowledge.exportName`); real usages now non-zero on all four measured files. **Still open:** whether compound members need a public-container-level Knowledge model (`Dialog`, `Popover` as first-class entries), since most member Knowledge is still empty custom props (see empty-custom-props table above) even though usage matching now works.
6. Decide whether empty `ComponentProps` JSON should count as extracted success or a distinct “native-only / not agent-usable” bucket.
7. Schema/formatting review before release.

## Integration blockers (separate from extractor measurement)

These do not invalidate the skip-layer counts above.

- Tests hardcode `../deeps-www`. That path does not exist; the measured copy is `/Users/melly/git/(2)deeps-www`. Fails: `tests/native-boolean-runtime-loop.test.ts` (deeps-www case), `tests/fixture-harness-playwright.test.ts`.
- Playwright app harness: Chromium not installed in this environment.
- MCP stdio: passed in this environment (previous “connection closed” did not reproduce).
- Package smoke: `pnpm build` in this repo fails immediately on Homebrew pnpm 8.15.8 with `Invalid package manager specification in package.json (pnpm@^11.9.0); expected a semver version`. `devEngines.packageManager.onFail: "warn"` is npm’s semantics. pnpm 8 treats the caret as a Corepack `packageManager` spec and hard-fails before `onFail`. From `/tmp`, `pnpm -v` prints 8.15.8. This is a **repo-root developer/smoke** failure, not proof that `archsync-fe@0.1.1` cannot be installed as a dependency. Confirm consumer install separately; do not leave the smoke test red.

Non-browser regression excluding those path/playwright/smoke cases: 28 files / 151 tests passed. The deeps-www-path case is the remaining failure in that group.

Keep raw generated Knowledge, logs, inventories, temporary project paths, and baseline tarballs out of Git.
