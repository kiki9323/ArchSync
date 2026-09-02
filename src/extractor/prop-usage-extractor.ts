import { Node, type SourceFile } from 'ts-morph';

import type { PropUsage } from '../schema/component-raw.js';

export function extractPropUsages(sourceFile: SourceFile, propNames: string[]): Map<string, PropUsage[]> {
  const usages = new Map<string, PropUsage[]>();

  for (const propName of propNames) {
    usages.set(propName, []);
  }

  sourceFile.forEachDescendant((node) => {
    if (Node.isConditionalExpression(node)) {
      collectUsage(node.getCondition(), propNames, (propName) => {
        usages.get(propName)?.push({
          kind: 'conditional',
          context: getUsageContext(node),
          expression: node.getText(),
        });
      });
    }

    if (Node.isBinaryExpression(node)) {
      if (node.getOperatorToken().getText() !== '&&') {
        return;
      }

      collectUsage(node.getLeft(), propNames, (propName) => {
        usages.get(propName)?.push({
          kind: 'logical-condition',
          context: getUsageContext(node),
          expression: node.getText(),
        });
      });
    }
  });

  return usages;
}

function getUsageContext(node: Node): 'jsx' | 'expression' {
  let current: Node | undefined = node;

  while (current) {
    if (
      Node.isJsxExpression(current) ||
      Node.isJsxElement(current) ||
      Node.isJsxSelfClosingElement(current) ||
      Node.isJsxFragment(current)
    ) {
      return 'jsx';
    }

    current = current.getParent();
  }

  return 'expression';
}

function collectUsage(node: Node, propNames: string[], onMatch: (propName: string) => void): void {
  const identifiers = [...(Node.isIdentifier(node) ? [node] : []), ...node.getDescendants().filter(Node.isIdentifier)];
  const matched = new Set<string>();

  for (const identifier of identifiers) {
    const name = identifier.getText();

    if (propNames.includes(name) && !matched.has(name)) {
      matched.add(name);
      onMatch(name);
    }
  }
}
