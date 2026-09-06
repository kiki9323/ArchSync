import {
  ArchsyncCommandParseSchema,
  ArchsyncWorkflowSchema,
  type ArchsyncCommandParse,
  type ArchsyncWorkflow,
} from '../schema/archsync-command.js';

/**
 * Protocol-neutral /archsync workflow.
 * Adapters only render this. They do not add product rules.
 */
export const archsyncSlashWorkflow: ArchsyncWorkflow =
  ArchsyncWorkflowSchema.parse({
    version: '0.1',
    name: 'archsync',
    trigger: '/archsync',
    tools: {
      search: 'archsync_search_context',
      context: 'archsync_get_component_context',
      validate: 'archsync_validate',
    },
    steps: [
      'parse-request',
      'search_context',
      'get_component_context',
      'implement-from-knowledge',
      'validate-static',
      'fix-from-violations',
      'revalidate',
      'report',
    ],
    rules: [
      'handle only an explicit /archsync request',
      'do not hardcode product variant or size values in this workflow',
      'read component rules only from ArchSync Knowledge or MCP',
      'do not invent values absent from Knowledge',
      'no-match or missing: do not guess a similar component',
      'failed: fix only using violation evidence',
      'unknown: report, do not treat as pass',
      'do not run runtime validation unless asked',
    ],
  });

const TRIGGER = '/archsync';

export function parseArchsyncCommand(input: string): ArchsyncCommandParse {
  const trimmed = input.trim();
  const match = trimmed.match(/^\/archsync(?:\s+([\s\S]+))?$/i);

  if (!match) {
    return ArchsyncCommandParseSchema.parse({
      status: 'ignored',
      reason: 'not-archsync-command',
    });
  }

  const request = match[1]?.trim();

  if (!request) {
    return ArchsyncCommandParseSchema.parse({
      status: 'invalid',
      trigger: TRIGGER,
      reason: 'empty-request',
    });
  }

  return ArchsyncCommandParseSchema.parse({
    status: 'ready',
    trigger: TRIGGER,
    request,
  });
}
