---
name: archsync
description: Runs ArchSync search, component context, implement, and static validate. Use only when the user invokes /archsync.
---

# /archsync

Follow the same workflow as `archsync/.cursor/skills/archsync/SKILL.md`.

1. Parse the text after `/archsync` as the request.
2. `archsync_search_context`
3. `archsync_get_component_context`
4. Implement from Knowledge only
5. `archsync_validate` (`mode: static`)
6. Fix from violation evidence and revalidate
