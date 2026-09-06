import { Node, SyntaxKind, Type, type SourceFile } from 'ts-morph';

import { toHtmlBooleanAttribute } from '../runtime/html-boolean-attributes.js';

export interface NativeBooleanAttribute {
  prop: string;
  attribute: string;
  source: string;
}

export function collectNativeBooleanAttributes(
  type: Type,
  location: Node,
  source: string,
): NativeBooleanAttribute[] {
  const attributes: NativeBooleanAttribute[] = [];

  for (const property of type.getProperties()) {
    const prop = property.getName();
    const attribute = toHtmlBooleanAttribute(prop);

    if (!attribute) {
      continue;
    }

    const propertyType = property.getTypeAtLocation(location);

    if (!isBooleanLike(propertyType)) {
      continue;
    }

    attributes.push({ prop, attribute, source });
  }

  return attributes;
}

/** 해당 컴포넌트 JSX에 실제로 적힌 React prop만 host에서 관측 가능하다. `{...props}` spread는 제외. */
export function collectJsxAttributeNames(sourceFile: SourceFile, componentName: string): Set<string> {
  const names = new Set<string>();
  const scope = sourceFile.getVariableDeclaration(componentName) ?? sourceFile;

  for (const attr of scope.getDescendantsOfKind(SyntaxKind.JsxAttribute)) {
    names.add(attr.getNameNode().getText());
  }

  return names;
}

function isBooleanLike(type: Type): boolean {
  const core = type.getNonNullableType();

  if (core.isBoolean() || core.isBooleanLiteral()) {
    return true;
  }

  if (!core.isUnion()) {
    return false;
  }

  return core.getUnionTypes().every((item) => item.isBoolean() || item.isBooleanLiteral());
}
