import { archsyncSlashWorkflow } from './archsync-command.js';

/**
 * Shared instruction body for Cursor / Claude / Codex adapters.
 */
export function renderArchsyncCommandMarkdown(): string {
  const workflow = archsyncSlashWorkflow;

  return [
    `# ${workflow.trigger}`,
    '',
    'Run the ArchSync Knowledge workflow for an explicit `/archsync <request>` only.',
    'Do not auto-detect UI work. Do not invent semantic search or an auto-fix engine.',
    '',
    '## Parse',
    '',
    '- Take the text after `/archsync` as the user request.',
    '- If the request is empty, stop and ask for a task.',
    '- `projectPath` is the frontend repo root that contains `.knowledge/components`.',
    '- Use the request text as the search query. Do not translate or add component names.',
    '',
    '## Workflow',
    '',
    `1. \`${workflow.tools.search}\` with the user request as \`query\`.`,
    `2. \`${workflow.tools.context}\` for each matched component.`,
    '3. Implement using only returned allowed values, defaults, and behaviors.',
    `4. \`${workflow.tools.validate}\` with \`mode: "static"\` and the changed file.`,
    '5. If failed, fix from violation evidence and validate again.',
    '6. Report tools used, Knowledge used, validation result, and file changes.',
    '',
    '## Rules',
    '',
    ...workflow.rules.map((rule) => `- ${rule}`),
    '',
  ].join('\n');
}
