import { getComponentCallable, resolveComponentProps } from './resolve-component-props.js';
export { resolvePropsDeclaration } from './resolve-component-props.js';
import path from 'node:path';
import { Node, Project, Type } from 'ts-morph';

import {
  collectJsxAttributeNames,
  collectNativeBooleanAttributes,
} from './native-boolean-attributes.js';
import { extractPropUsages } from './prop-usage-extractor.js';
import { ComponentRawSchema, type ComponentRaw } from '../schema/component-raw.js';

export interface ExtractComponentInput {
  /**
   * Target frontend project root.
   * Uses that project's tsconfig and node_modules.
   */
  projectRoot: string;

  /**
   * Source file, absolute or relative to projectRoot.
   */
  file: string;

  propsInterfaceName?: string;
  project?: Project;
  componentName?: string;
}

type DefaultValue = string | number | boolean | null;

/**
 * TypeScript가 resolve한 타입에서
 * string / number literal union 값을 추출한다.
 *
 * example:
 * "filled" | "outline" | undefined
 * → ["filled", "outline"]
 *
 * boolean | undefined
 * → undefined
 */
function getLiteralValues(type: Type): string[] | undefined {
  const nonNullableType = type.getNonNullableType();

  if (nonNullableType.isStringLiteral()) {
    return [String(nonNullableType.getLiteralValue())];
  }

  if (nonNullableType.isNumberLiteral()) {
    return [String(nonNullableType.getLiteralValue())];
  }

  if (!nonNullableType.isUnion()) {
    return undefined;
  }

  const unionTypes = nonNullableType.getUnionTypes();

  const allLiteral = unionTypes.every(
    (unionType) => unionType.isStringLiteral() || unionType.isNumberLiteral(),
  );

  if (!allLiteral) {
    return undefined;
  }

  return unionTypes.map((unionType) => String(unionType.getLiteralValue()));
}

/**
 * AST node가 정적으로 확정 가능한 literal이면
 * 실제 JS 값으로 변환한다.
 *
 * 'filled' → "filled"
 * 10       → 10
 * false    → false
 * null     → null
 *
 * getValue() 같은 표현식은 추론하지 않는다.
 */
function getDefaultValue(node: Node): DefaultValue | undefined {
  if (Node.isStringLiteral(node)) {
    return node.getLiteralValue();
  }

  if (Node.isNumericLiteral(node)) {
    return node.getLiteralValue();
  }

  if (node.getKindName() === 'TrueKeyword') {
    return true;
  }

  if (node.getKindName() === 'FalseKeyword') {
    return false;
  }

  if (node.getKindName() === 'NullKeyword') {
    return null;
  }

  return undefined;
}

/**
 * project 내부 파일은 projectRoot 기준 상대경로로 만든다.
 *
 * /Users/.../deeps-www/src/Button.tsx
 * → src/Button.tsx
 */
function toProjectPath(projectRoot: string, filePath: string): string {
  const relativePath = path.relative(projectRoot, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return filePath;
  }

  return relativePath.split(path.sep).join('/');
}

/**
 * 해당 declaration이 target project 외부에서
 * 온 것인지 판단한다.
 *
 * React.ButtonHTMLAttributes 같은 타입을
 * custom props로 펼치지 않기 위해 사용한다.
 */
function isExternalSource(projectRoot: string, filePath: string): boolean {
  const normalized = filePath.split(path.sep).join('/');

  if (normalized.includes('/node_modules/')) {
    return true;
  }

  const relativePath = path.relative(projectRoot, filePath);

  return relativePath.startsWith('..') || path.isAbsolute(relativePath);
}

/**
 * Component implementation에서
 * destructuring default value를 추출한다.
 *
 * React.forwardRef(...,
 *   ({
 *     variant = 'filled',
 *     size = 'h40',
 *     isLoading = false,
 *   }) => ...
 * )
 *
 * ↓
 *
 * Map {
 *   variant → "filled",
 *   size → "h40",
 *   isLoading → false
 * }
 */
function extractDefaultValues(
  sourceFile: ReturnType<Project['addSourceFileAtPath']>,
  componentName: string,
): Map<string, DefaultValue> {
  const defaults = new Map<string, DefaultValue>();

  const callback = getComponentCallable(sourceFile, componentName);
  if (!callback) return defaults;

  // ({ variant = 'filled' }, ref)
  //  ↑
  // 첫 번째 parameter
  const propsParameter = callback.getParameters()[0];

  if (!propsParameter) {
    return defaults;
  }

  const nameNode = propsParameter.getNameNode();

  if (!Node.isObjectBindingPattern(nameNode)) {
    return defaults;
  }

  for (const element of nameNode.getElements()) {
    const initializer = element.getInitializer();

    if (!initializer) {
      continue;
    }

    const defaultValue = getDefaultValue(initializer);

    // 정적으로 확정할 수 없는 값은
    // RAW에 넣지 않는다.
    if (defaultValue === undefined) {
      continue;
    }

    defaults.set(element.getPropertyNameNode()?.getText() ?? element.getName(), defaultValue);
  }

  return defaults;
}

/**
 * Component의 props 정보를 추출하여
 * ArchSync RAW representation으로 만든다.
 */
export function extractComponent(input: ExtractComponentInput): ComponentRaw {
  const projectRoot = path.resolve(input.projectRoot);

  const tsConfigFilePath = path.join(projectRoot, 'tsconfig.json');

  const filePath = path.isAbsolute(input.file) ? input.file : path.join(projectRoot, input.file);

  /**
   * 중요:
   *
   * ArchSync 자신의 tsconfig가 아니라
   * 분석 대상 frontend project의
   * tsconfig를 사용한다.
   *
   * 따라서 React / vanilla-extract 등의
   * 실제 TypeScript context를 사용할 수 있다.
   */
  const project = input.project ?? new Project({
    tsConfigFilePath,
  });

  const sourceFile = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);

  const componentName = input.componentName ?? input.propsInterfaceName?.replace(/Props$/, '');
  if (!componentName) throw new Error('componentName or propsInterfaceName is required');
  const props = resolveComponentProps(sourceFile, componentName, input.propsInterfaceName);
  const propsInterface = props.location;

  /**
   * Button.tsx implementation에서
   * default values를 먼저 수집한다.
   */
  const defaultValues = extractDefaultValues(sourceFile, componentName);

  const nativeProps: ComponentRaw['nativeProps'] = [];
  const nativeBooleanAttributes: NonNullable<ComponentRaw['nativeBooleanAttributes']> = [];

  const customProps: ComponentRaw['customProps'] = [];

  const visited = new Set<Type>();
  function collectNative(type: Type, location: Node, declaredSource: string): void {
    if (visited.has(type)) return;
    visited.add(type);
    if (type.isIntersection()) {
      for (const part of type.getIntersectionTypes()) collectNative(part, location, part.getText(location));
      return;
    }
    const symbol = type.getSymbol() ?? type.getAliasSymbol();
    const declaration = symbol?.getDeclarations()[0];
    if (declaration && isExternalSource(projectRoot, declaration.getSourceFile().getFilePath())) {
      nativeProps.push({ name: symbol!.getName(), source: declaredSource, expanded: false });
      for (const attribute of collectNativeBooleanAttributes(type, location, declaredSource)) {
        if (!nativeBooleanAttributes.some(item => item.prop === attribute.prop && item.attribute === attribute.attribute)) nativeBooleanAttributes.push(attribute);
      }
      return;
    }
    if (declaration && Node.isInterfaceDeclaration(declaration)) {
      for (const heritage of declaration.getExtends()) collectNative(heritage.getType(), heritage, heritage.getText());
    }
  }
  if (props.type) collectNative(props.type, propsInterface, props.location.getText());

  // Resolve the complete type, including aliases, intersections and inherited props.
  for (const symbol of (props.type?.getProperties() ?? [])) {
    const property = symbol.getDeclarations()[0];
    if (!property || isExternalSource(projectRoot, property.getSourceFile().getFilePath())) continue;
    const type = symbol.getTypeAtLocation(propsInterface);
    customProps.push({
      name: symbol.getName(),
      declaredType: Node.isPropertySignature(property) ? property.getTypeNode()?.getText() ?? 'unknown' : type.getText(property),
      resolvedType: type.getText(propsInterface),
      values: getLiteralValues(type),
      optional: symbol.isOptional(),
      defaultValue: defaultValues.get(symbol.getName()),
      source: toProjectPath(projectRoot, property.getSourceFile().getFilePath()),
    });
  }
  const renderedPropNames = collectJsxAttributeNames(sourceFile, componentName);
  const observableNativeBooleanAttributes = nativeBooleanAttributes.filter((item) =>
    renderedPropNames.has(item.prop),
  );

  const propUsages = extractPropUsages(
    getComponentCallable(sourceFile, componentName) ?? sourceFile,
    customProps.map((prop) => prop.name),
  );

  return ComponentRawSchema.parse({
    component: componentName,

    source: toProjectPath(projectRoot, sourceFile.getFilePath()),

    nativeProps,
    nativeBooleanAttributes:
      observableNativeBooleanAttributes.length > 0 ? observableNativeBooleanAttributes : undefined,
    customProps: customProps.map((prop) => {
      const usage = propUsages.get(prop.name);

      return {
        ...prop,
        usage: usage && usage.length > 0 ? usage : undefined,
      };
    }),
  });
}
