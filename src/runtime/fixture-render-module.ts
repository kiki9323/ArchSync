export function generateFixtureRenderModule(input: {
  modulePath: string;
  exportName: string;
}): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(input.exportName)) {
    throw new Error(`Invalid fixture export name: ${input.exportName}`);
  }

  const specifier = toViteSpecifier(input.modulePath);

  return `import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ${input.exportName} as Component } from ${JSON.stringify(specifier)};

const root = document.getElementById('root');

if (!root) {
  throw new Error('ArchSync fixture root is missing');
}

const params = new URLSearchParams(window.location.search);
const props = JSON.parse(params.get('props') ?? '{}');

createRoot(root).render(createElement(Component, props, 'Fixture'));
`;
}

export function toViteSpecifier(modulePath: string): string {
  const normalized = modulePath.split('\\').join('/');

  if (normalized.startsWith('/')) {
    return normalized;
  }

  return `/${normalized}`;
}

export const FIXTURE_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ArchSync fixture</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/__archsync/render.tsx"></script>
  </body>
</html>
`;
