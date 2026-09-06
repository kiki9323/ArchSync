import type { ComponentBehavior, ComponentKnowledge } from '../schema/component-knowledge.js';

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

    const behaviorLines = uniqueBehaviorLines(prop.behavior);

    if (behaviorLines.length > 0) {
      lines.push('- Behavior:');

      for (const behaviorLine of behaviorLines) {
        lines.push(`  - ${behaviorLine}`);
      }
    }

    lines.push('');
  }

  if (knowledge.nativeProps.length > 0 || (knowledge.nativeAttributes?.length ?? 0) > 0) {
    lines.push('## Native Props');
    lines.push('');

    for (const nativeProp of knowledge.nativeProps) {
      lines.push(`- \`${nativeProp.source}\``);
    }

    for (const attribute of knowledge.nativeAttributes ?? []) {
      if (attribute.prop === attribute.attribute) {
        lines.push(`- Observable: \`${attribute.prop}\``);
      } else {
        lines.push(`- Observable: \`${attribute.prop}\` → \`${attribute.attribute}\``);
      }
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

const behaviorCopy: Record<ComponentBehavior['kind'], string> = {
  'conditional-render': 'Conditional render',
  'conditional-logic': 'Conditional logic',
};

function uniqueBehaviorLines(behaviors: ComponentBehavior[] | undefined): string[] {
  if (!behaviors?.length) {
    return [];
  }

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const behavior of behaviors) {
    const line = behaviorCopy[behavior.kind];

    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }

  return lines;
}
