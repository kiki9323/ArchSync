---
description: ArchSync search → context → implement → validate
---

Run the ArchSync Knowledge workflow for `$ARGUMENTS` after an explicit `/archsync`.

`projectPath` is the frontend repo root that contains `.knowledge/components`.

1. `archsync_search_context` with `$ARGUMENTS` as `query`.
2. `archsync_get_component_context` for each matched component.
3. Implement using only returned allowed values, defaults, and behaviors.
4. `archsync_validate` with `mode: "static"` and the changed file.
5. If failed, fix from violation evidence and validate again.

Do not hardcode product variant/size values. Do not auto-detect work without `/archsync`.
