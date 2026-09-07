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
    const matched = Node.isPropertyAccessExpression(tag)
      ? matchesCompoundMemberTag(tag, knowledge)
      : matchesIdentifierTag(tag, knowledge);
    if (!matched) {
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

function declarationMatchesSource(declarations: Node[], knowledge: ComponentKnowledge): boolean {
  return declarations.some((declaration) => {
    const filePath = declaration.getSourceFile().getFilePath().split(path.sep).join('/');
    return knowledge.sources.some((source) => filePath === source || filePath.endsWith('/' + source));
  });
}

/**
 * `<Button />` — a plain JSX identifier. Matched by resolving the tag's own symbol.
 */
function matchesIdentifierTag(tag: Node, knowledge: ComponentKnowledge): boolean {
  const symbol = tag.getSymbol();
  const resolved = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  const declarations = resolved?.getDeclarations() ?? [];
  const matchesSource = declarationMatchesSource(declarations, knowledge);
  const matchesName = resolved?.getName() === knowledge.component;
  const imported = symbol?.getDeclarations().some((d) => Node.isImportSpecifier(d) || Node.isImportClause(d));

  return (matchesSource && matchesName) || (tag.getText() === knowledge.component && !imported && declarations.length === 0);
}

/**
 * `<Dialog.Root />` — a JSX member expression. The public identity (`Dialog.Root`) is
 * usually a different string from the implementation export (`DialogRoot`), so matching
 * by name/symbol on the tag itself does not work. Instead we walk the same
 * export/composition shape discovery relies on (`export const Dialog = { Root: DialogRoot }`)
 * to find what `Root` actually refers to, then match that against Knowledge like any other
 * identifier. Nothing here is inferred from the `Dialog.Root` string itself.
 */
function matchesCompoundMemberTag(
  tag: import('ts-morph').PropertyAccessExpression,
  knowledge: ComponentKnowledge,
): boolean {
  const identity = resolveCompoundMemberIdentity(tag);

  if (identity) {
    return identity.name === knowledge.component && declarationMatchesSource(identity.declarations, knowledge);
  }

  // Composition couldn't be resolved structurally (e.g. an external namespace object).
  // Fall back to the public identity Knowledge recorded at discovery time, itself derived
  // from real export/composition AST rather than guessed from the implementation name.
  return knowledge.exportName !== undefined && tag.getText() === knowledge.exportName;
}

function resolveCompoundMemberIdentity(
  tag: import('ts-morph').PropertyAccessExpression,
): { name?: string; declarations: Node[] } | undefined {
  const memberName = tag.getName();
  const objectSymbol = tag.getExpression().getSymbol();
  const resolvedObjectSymbol = objectSymbol?.isAlias() ? objectSymbol.getAliasedSymbol() : objectSymbol;

  for (const objectDeclaration of resolvedObjectSymbol?.getDeclarations() ?? []) {
    if (!Node.isVariableDeclaration(objectDeclaration)) continue;

    const initializer = objectDeclaration.getInitializer();
    if (!initializer || !Node.isObjectLiteralExpression(initializer)) continue;

    for (const property of initializer.getProperties()) {
      if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) continue;
      if (property.getName() !== memberName) continue;

      const value = Node.isPropertyAssignment(property) ? property.getInitializer() : property.getNameNode();
      if (!value || !Node.isIdentifier(value)) continue;

      const valueSymbol = value.getSymbol();
      const resolvedValue = valueSymbol?.isAlias() ? valueSymbol.getAliasedSymbol() : valueSymbol;
      const valueDeclarations = resolvedValue?.getDeclarations() ?? [];

      if (valueDeclarations.length > 0) {
        return { name: resolvedValue?.getName(), declarations: valueDeclarations };
      }
    }
  }

  return undefined;
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
