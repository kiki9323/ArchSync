# Extractor and validation coverage follow-up

This document records the unfinished work on the extractor and validation coverage branch so it can be resumed without relying on local audit artifacts.

## Reproduced baseline

The ArchSync 0.1.0 package was run against an unchanged copy of `deeps-www` using these component roots:

- `src/components/ui`
- `src/components/shared`

The result reproduced the previously reported baseline exactly:

- discovered: 80
- Knowledge generated: 11
- skipped: 69
- failed: 0
- extraction coverage: 11 / 80 = 13.75%

The 0.1.0 Button validation result was also reproduced:

- usages: 140
- checked: 256
- unknown: 124
- violations: 0
- status: `passed`

Under the new status rules, the same aggregate result maps to `partial` because deterministic checks passed while unknown checks remain.

## Work currently present on this branch

- Type alias and imported props resolution
- Import alias resolution in static usage validation
- `partial` and `not-checked` validation statuses
- Extraction and validation coverage fields in reports
- `--strict` as a CLI/CI policy layer
- Experimental support for inline/intersection props, React `ComponentProps` variants, contextual `forwardRef`/`FC` props, and compound component exports
- Regression tests for the supported props shapes and strict-mode behavior

The non-browser regression suite passed locally: 29 test files and 152 tests. Playwright, MCP stdio, and package-install smoke tests are tracked separately below.

## Must finish before merging

1. Fix or explain the `Button.color` extraction regression. The 0.1.0 Knowledge contains `color: string | undefined`; the current experimental extraction omits it. This also changes Button unknowns from 124 to 50, so that reduction must not be claimed as a validation coverage improvement.
2. Re-run the 80-component cohort after the regression is fixed. Report both:
   - the fixed original cohort (`generated / 80`), and
   - any expanded discovery inventory, with the larger denominator stated separately.
3. Produce a concise skip-reason breakdown. Do not collapse unsupported inline props, `ComponentProps`, compound containers, no-props components, export-shape limitations, and parse errors into `props-interface-not-found`.
4. Complete the requested representative-component table for Button, LinkButton, RefreshButton, TopButton, Dialog, Popover, Table, one `React.FC<{...}>` component, and one `React.ComponentProps` component.
5. Complete the validation matrix for dynamic expressions, spreads, unregistered props, open-ended string props, import aliases, and strict-mode exit codes.
6. Decide whether compound member implementations should each receive Knowledge, or whether public containers such as `Dialog`, `Popover`, and `Table` need a container-level Knowledge model. Current experimental discovery generates member implementation Knowledge and does not generate standalone container Knowledge.
7. Review formatting and public schema compatibility before treating the branch as release-ready.

## Known semantic limitations

- External React and Base UI props are retained as unexpanded native evidence. A successful extraction does not mean every external prop has finite values.
- Dynamic expressions remain unknown.
- JSX spreads remain unknown as one spread occurrence; individual properties inside the spread are not evaluated.
- Unregistered props are currently ignored. A usage containing only unregistered props can become `not-checked`.
- Open-ended props such as `color: string` are unknown when present because Knowledge has no finite value set.
- Props unions are intentionally rejected because the current flat RAW schema cannot preserve branch relationships.
- Classes, anonymous default exports, and some re-export shapes are outside the current discovery model.

## Integration blockers observed during local audit

These do not invalidate the extractor measurements, but they prevent claiming a complete integration pass:

- Playwright app/fixture tests: local permission/listener or adjacent-project write restrictions
- MCP stdio test: connection closed
- Package smoke test: package installation timed out in the restricted environment

Keep raw generated Knowledge, logs, JSON inventories, temporary project paths, and baseline tarballs out of Git. They are ignored by `.gitignore`; regenerate them locally when continuing this audit.
