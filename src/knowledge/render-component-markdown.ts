import type { ComponentKnowledge } from '../schema/component-knowledge.js';

export function renderComponentMarkdown(knowledge: ComponentKnowledge): string {
  const lines: string[] = [];

  lines.push(`# ${knowledge.component}`);
  lines.push('');

  if (knowledge.summary) {
    lines.push(knowledge.summary);
    lines.push('');
  }

  lines.push('## Props');
  lines.push('');

  for (const prop of knowledge.props) {
    lines.push(`### ${prop.name}`);
    lines.push('');

    if (prop.description) {
      lines.push(prop.description);
      lines.push('');
    }

    lines.push(`- Type: \`${prop.type}\``);
    lines.push(`- Optional: ${prop.optional ? 'yes' : 'no'}`);

    if (prop.values?.length) {
      lines.push(`- Allowed values: ${prop.values.map((value) => `\`${value}\``).join(', ')}`);
    }

    if (prop.defaultValue !== undefined) {
      lines.push(`- Default: \`${String(prop.defaultValue)}\``);
    }

    if (prop.behavior) {
      lines.push(`- Behavior: ${prop.behavior}`);
    }

    lines.push('');
  }

  if (knowledge.nativeProps.length > 0) {
    lines.push('## Native Props');
    lines.push('');

    for (const nativeProp of knowledge.nativeProps) {
      lines.push(`- \`${nativeProp.source}\``);
    }

    lines.push('');
  }

  lines.push('## Sources');
  lines.push('');

  for (const source of knowledge.sources) {
    lines.push(`- \`${source}\``);
  }

  return lines.join('\n');
}
