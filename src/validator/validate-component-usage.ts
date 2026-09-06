import path from 'node:path';
import { Node, type SourceFile } from 'ts-morph';

import type { ComponentKnowledge } from '../schema/component-knowledge.js';

export type UsageUnknownReason = 'knowledge has no finite values' | 'dynamic expression' | 'spread attribute';

export interface UsageViolation {
  file: string;
  line: number;
  component: string;
  prop: string;
  value: string;
  allowed: string[];
}

export interface UsageUnknown {
  file: string;
  line: number;
  component: string;
  prop: string;
  reason: UsageUnknownReason;
}

export interface FileUsageValidation {
  usages: number;
  checked: number;
  violations: UsageViolation[];
  unknown: UsageUnknown[];
}

/**
 * Knowledge SSOT의 allowed values와 실제 JSX 사용을 비교한다.
 *
 * pass / violation / unknown.
 * 리터럴이 아니거나 finite values가 없으면 건너뛰지 않고 unknown으로 남긴다.
 * Level 3 컨벤션은 검사하지 않는다.
 */
export function validateComponentUsage(
  knowledge: ComponentKnowledge,
  sourceFile: SourceFile,
): FileUsageValidation {
  const propByName = new Map(knowledge.props.map((prop) => [prop.name, prop]));
  const file = sourceFile.getFilePath();
  const violations: UsageViolation[] = [];
  const unknown: UsageUnknown[] = [];
  let usages = 0;
  let checked = 0;

  sourceFile.forEachDescendant((node) => {
    if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node)) {
      return;
    }

    const tag = node.getTagNameNode();
    const symbol = tag.getSymbol();
    const resolved = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
    const declarations = resolved?.getDeclarations() ?? [];
    const matchesSource = declarations.some(declaration => {
      const filePath = declaration.getSourceFile().getFilePath().split(path.sep).join('/');
      return knowledge.sources.some(source => filePath === source || filePath.endsWith('/' + source));
    });
    const matchesName = resolved?.getName() === knowledge.component;
    const imported = symbol?.getDeclarations().some(d => Node.isImportSpecifier(d) || Node.isImportClause(d));
    if (!(matchesSource && matchesName) && !(tag.getText() === knowledge.component && !imported && declarations.length === 0)) {
      return;
    }

    usages += 1;

    for (const attribute of node.getAttributes()) {
      if (!Node.isJsxAttribute(attribute)) {
        unknown.push({ file, line: attribute.getStartLineNumber(), component: knowledge.component, prop: '*', reason: 'spread attribute' });
        continue;
      }

      const propName = attribute.getNameNode().getText();
      const prop = propByName.get(propName);

      if (!prop) {
        continue;
      }

      const location = {
        file,
        line: attribute.getStartLineNumber(),
        component: knowledge.component,
        prop: propName,
      };

      if (!prop.values?.length) {
        {
          unknown.push({
            ...location,
            reason: 'knowledge has no finite values',
          });
        }

        continue;
      }

      const value = readLiteralAttributeValue(attribute);

      if (value === undefined) {
        unknown.push({
          ...location,
          reason: 'dynamic expression',
        });
        continue;
      }

      checked += 1;

      if (!prop.values.includes(value)) {
        violations.push({
          ...location,
          value,
          allowed: prop.values,
        });
      }
    }
  });

  return { usages, checked, violations, unknown };
}

function readLiteralAttributeValue(attribute: Node): string | undefined {
  if (!Node.isJsxAttribute(attribute)) {
    return undefined;
  }

  const initializer = attribute.getInitializer();

  if (!initializer) {
    return undefined;
  }

  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText();
  }

  if (!Node.isJsxExpression(initializer)) {
    return undefined;
  }

  const expression = initializer.getExpression();

  if (
    expression &&
    (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression))
  ) {
    return expression.getLiteralText();
  }

  return undefined;
}
