import {
  ComponentKnowledgeSchema,
  type ComponentKnowledge,
} from '../schema/component-knowledge.js';
import type { ComponentRaw } from '../schema/component-raw.js';
import { transformPropBehavior } from './transform-prop-behavior.js';

export function createComponentKnowledge(raw: ComponentRaw): ComponentKnowledge {
  const sources = new Set<string>();

  sources.add(raw.source);

  const props = raw.customProps.map((prop) => {
    sources.add(prop.source);

    const behavior = prop.usage?.length ? transformPropBehavior(prop.usage) : undefined;

    return {
      name: prop.name,
      type: prop.resolvedType,
      optional: prop.optional,
      values: prop.values,
      defaultValue: prop.defaultValue,
      behavior,
    };
  });

  const knowledge = {
    component: raw.component,
    nativeProps: raw.nativeProps.map((nativeProp) => ({
      source: nativeProp.source,
    })),
    nativeAttributes: raw.nativeBooleanAttributes?.map((item) => ({
      prop: item.prop,
      attribute: item.attribute,
    })),
    props,
    sources: [...sources],
  };

  return ComponentKnowledgeSchema.parse(knowledge);
}

/**
 * RAW를 그대로 AI에게 던지는 게 아니라 AI가 소비할 Knowledge 모델로 한 번 정규화하는 레이어 생성.
 * 이 레이어를 통해 AI가 소비할 정보를 구성할 수 있도록 한다.
 
- Extractor의 관심사
  - .ts/.tsx 이해
  - ComponentRaw 생성

- Knowledge의 관심사
  - AI에게 제공할 정보 구성
  - ComponentKnowledge 생성
 */
