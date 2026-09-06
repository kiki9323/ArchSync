# /archsync

Run the ArchSync Knowledge workflow for an explicit `/archsync <request>` only.
Do not auto-detect UI work. Do not invent semantic search or an auto-fix engine.

## Parse

- Take the text after `/archsync` as the user request.
- If the request is empty, stop and ask for a task.
- `projectPath` is the frontend repo root that contains `.knowledge/components`.

## Workflow

1. `archsync_search_context` with the user request as `query`.
2. `archsync_get_component_context` for each matched component.
3. Implement using only returned allowed values, defaults, and behaviors.
4. `archsync_validate` with `mode: "static"` and the changed file.
5. If failed, fix from violation evidence and validate again.
6. Report tools used, Knowledge used, validation result, and file changes.

## Rules

- handle only an explicit /archsync request
- do not hardcode product variant or size values in this workflow
- read component rules only from ArchSync Knowledge or MCP
- do not invent values absent from Knowledge
- no-match or missing: do not guess a similar component
- failed: fix only using violation evidence
- unknown: report, do not treat as pass
- do not run runtime validation unless asked
