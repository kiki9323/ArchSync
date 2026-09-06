import { Node, type SourceFile, type Type } from 'ts-morph';

export type PropsResolution = 'interface' | 'type-alias' | 'imported' | 'inline' | 'component-props' | 'inferred' | 'no-props';
export interface ResolvedComponentProps {
  location: Node;
  type?: Type;
  kind: PropsResolution;
  name?: string;
}

export function resolvePropsDeclaration(sourceFile: SourceFile, name: string) {
  const local = sourceFile.getInterface(name) ?? sourceFile.getTypeAlias(name);
  if (local) return local;
  const symbol = sourceFile.getLocal(name);
  const resolved = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  const declaration = resolved?.getDeclarations().find(node => Node.isInterfaceDeclaration(node) || Node.isTypeAliasDeclaration(node));
  if (!declaration || !(Node.isInterfaceDeclaration(declaration) || Node.isTypeAliasDeclaration(declaration))) {
    throw new Error(`Props declaration not found: ${name}`);
  }
  return declaration;
}

export function getComponentCallable(sourceFile: SourceFile, name: string) {
  const declaration = sourceFile.getFunction(name) ?? sourceFile.getVariableDeclaration(name);
  if (!declaration) return undefined;
  if (Node.isFunctionDeclaration(declaration)) return declaration;
  function unwrap(node: Node | undefined): ReturnType<SourceFile['getFunction']> | import('ts-morph').ArrowFunction | import('ts-morph').FunctionExpression | undefined {
    if (!node) return undefined;
    if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) return node;
    if (Node.isCallExpression(node)) return unwrap(node.getArguments()[0]);
    if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node) || Node.isSatisfiesExpression(node)) return unwrap(node.getExpression());
    return undefined;
  }
  return unwrap(declaration.getInitializer());
}

export function resolveComponentProps(sourceFile: SourceFile, componentName: string, explicitName?: string): ResolvedComponentProps {
  const callable = getComponentCallable(sourceFile, componentName);
  const parameter = callable?.getParameters()[0];
  const annotation = parameter?.getTypeNode();
  // The implementation's full annotation wins over a same-named, narrower interface.
  if (annotation) {
    const text = annotation.getText();
    let kind: PropsResolution = 'inline';
    let name: string | undefined;
    if (/\bComponentProps(?:WithRef|WithoutRef)?\s*</.test(text)) kind = 'component-props';
    else {
      try {
        const declaration = resolvePropsDeclaration(sourceFile, text);
        name = text;
        kind = declaration.getSourceFile() !== sourceFile ? 'imported' : Node.isTypeAliasDeclaration(declaration) ? 'type-alias' : 'interface';
      } catch { /* Inline, intersection, mapped, or instantiated generic type. */ }
    }
    return checked({ location: annotation, type: annotation.getType(), kind, name });
  }
  if (parameter && !parameter.getType().isAny() && !parameter.getType().isUnknown()) {
    const type = parameter.getType();
    const symbol = type.getAliasSymbol() ?? type.getSymbol();
    const declaration = symbol?.getDeclarations()[0];
    const name = symbol?.getName();
    const kind = declaration && Node.isInterfaceDeclaration(declaration) ? 'interface' : declaration && Node.isTypeAliasDeclaration(declaration) ? 'type-alias' : 'inferred';
    return checked({ location: parameter, type, kind, name: kind === 'inferred' ? undefined : name });
  }
  // Retain explicit/manual extraction and legacy wrapper conventions.
  for (const name of new Set([explicitName, `${componentName}Props`])) {
    if (!name) continue;
    try {
      const declaration = resolvePropsDeclaration(sourceFile, name);
      return checked({ location: declaration, type: declaration.getType(), name, kind: declaration.getSourceFile() !== sourceFile ? 'imported' : Node.isTypeAliasDeclaration(declaration) ? 'type-alias' : 'interface' });
    } catch (error) {
      if (explicitName === name) throw error;
    }
  }
  if (callable && !parameter) return { location: callable, kind: 'no-props' };
  throw new Error('props-type-unresolved');
}

function checked(result: ResolvedComponentProps): ResolvedComponentProps {
  const type = result.type!;
  if (type.isAny() || type.isUnknown() || type.isNever()) throw new Error('props-type-unresolved');
  if (!type.isObject() && !type.isIntersection() && !type.isUnion() && !type.isTypeParameter()) throw new Error('props-type-not-object');
  // Union branch-only fields cannot be represented faithfully by the flat RAW schema.
  if (type.isUnion()) throw new Error('props-union-not-supported');
  return result;
}
