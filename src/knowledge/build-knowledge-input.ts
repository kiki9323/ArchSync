import type { ComponentRaw } from '../schema/component-raw.js';

export interface KnowledgeInputProp {
  name: string;
  type: string;
  values?: string[];
  defaultValue?: string | number | boolean | null;
}

export interface ComponentKnowledgeInput {
  component: string;

  nativeProps: string[];

  props: KnowledgeInputProp[];

  sources: string[];
}

export function buildKnowledgeInput(raw: ComponentRaw): ComponentKnowledgeInput {
  const sources = new Set<string>();

  sources.add(raw.source);

  const props = raw.customProps.map((prop) => {
    sources.add(prop.source);

    return {
      name: prop.name,
      type: prop.resolvedType,
      values: prop.values,
      defaultValue: prop.defaultValue,
    };
  });

  return {
    component: raw.component,

    nativeProps: raw.nativeProps.map((nativeProp) => nativeProp.source),

    props,

    sources: [...sources],
  };
}
