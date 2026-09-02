import path from 'node:path';
import { InterfaceDeclaration, Node, Project, Symbol as MorphSymbol, Type } from 'ts-morph';

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

  propsInterfaceName: string;
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
 * ts-morph Symbol이 가리키는 실제 declaration을 가져온다.
 */
function getSymbolDeclaration(symbol: MorphSymbol) {
  return symbol.getDeclarations()[0];
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

  const variable = sourceFile.getVariableDeclaration(componentName);

  if (!variable) {
    return defaults;
  }

  const initializer = variable.getInitializer();

  if (!initializer || !Node.isCallExpression(initializer)) {
    return defaults;
  }

  // React.forwardRef(
  //   (...) => ...
  // )
  //
  // 첫 번째 argument가 component callback
  const callback = initializer.getArguments()[0];

  if (!callback || !Node.isArrowFunction(callback)) {
    return defaults;
  }

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

    defaults.set(element.getName(), defaultValue);
  }

  return defaults;
}

/**
 * target project 내부 interface에서
 * custom prop 정보를 추출한다.
 */
function extractCustomProps(
  projectRoot: string,
  declaration: InterfaceDeclaration,
  defaultValues: Map<string, DefaultValue>,
): ComponentRaw['customProps'] {
  return declaration.getProperties().map((property) => {
    const type = property.getType();
    const typeNode = property.getTypeNode();

    const name = property.getName();

    return {
      name,

      // 코드에 실제로 선언된 타입
      //
      // ButtonVariants['variant']
      declaredType: typeNode?.getText() ?? 'unknown',

      // TypeScript가 최종적으로 계산한 타입
      //
      // "filled" | "outline" | ... | undefined
      resolvedType: type.getText(property),

      // literal union인 경우 실제 값
      values: getLiteralValues(type),

      optional: property.hasQuestionToken(),

      // component implementation에서
      // 추출한 default
      defaultValue: defaultValues.get(name),

      source: toProjectPath(projectRoot, property.getSourceFile().getFilePath()),
    };
  });
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
  const project = new Project({
    tsConfigFilePath,
  });

  const sourceFile = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);

  const propsInterface = sourceFile.getInterfaceOrThrow(input.propsInterfaceName);

  const componentName = input.propsInterfaceName.replace(/Props$/, '');

  /**
   * Button.tsx implementation에서
   * default values를 먼저 수집한다.
   */
  const defaultValues = extractDefaultValues(sourceFile, componentName);

  const nativeProps: ComponentRaw['nativeProps'] = [];

  const customProps: ComponentRaw['customProps'] = [];

  /**
   * example:
   *
   * interface ButtonProps
   *   extends
   *     React.ButtonHTMLAttributes<HTMLButtonElement>,
   *     CommonButtonProps {}
   */
  for (const heritage of propsInterface.getExtends()) {
    const declaredSource = heritage.getText();

    const type = heritage.getType();

    const symbol = type.getSymbol() ?? type.getAliasSymbol();

    const declaration = symbol ? getSymbolDeclaration(symbol) : undefined;

    const sourcePath = declaration?.getSourceFile().getFilePath() ?? '';

    /**
     * React.ButtonHTMLAttributes 같은
     * external type은 펼치지 않는다.
     */
    if (!declaration || isExternalSource(projectRoot, sourcePath)) {
      nativeProps.push({
        name: symbol?.getName() ?? declaredSource,

        // 사람이 이해할 수 있도록
        // 원래 heritage 표현을 남긴다.
        source: declaredSource,

        expanded: false,
      });

      continue;
    }

    /**
     * target project 내부 interface라면
     * design-system custom props로 취급한다.
     */
    if (Node.isInterfaceDeclaration(declaration)) {
      customProps.push(...extractCustomProps(projectRoot, declaration, defaultValues));
    }
  }

  return ComponentRawSchema.parse({
    component: componentName,

    source: toProjectPath(projectRoot, sourceFile.getFilePath()),

    nativeProps,
    customProps,
  });
}
