import type { FixtureTarget } from './fixture-session.js';

export function resolveFixtureTarget(input: {
  component: string;
  sources: string[];
  modulePath?: string;
}): FixtureTarget {
  const modulePath =
    input.modulePath ??
    input.sources.find(
      (source) => /\.tsx$/.test(source) && !/\.(types|stories|css)\./.test(source),
    ) ??
    input.sources[0];

  if (!modulePath) {
    throw new Error(`No fixture module found for ${input.component}`);
  }

  return {
    modulePath,
    exportName: input.component,
  };
}
