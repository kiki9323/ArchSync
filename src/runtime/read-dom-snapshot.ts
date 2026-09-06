import type { DomSnapshot } from './browser-tool.js';
import { HTML_BOOLEAN_ATTRIBUTES } from './html-boolean-attributes.js';
import type { PlaywrightPage } from './playwright-loader.js';

/**
 * Browser Tool의 Playwright 관측: selector root에서 HTML boolean attribute만 읽는다.
 * Storybook / App harness가 같은 구현을 쓴다.
 */
export async function readDomSnapshot(
  page: PlaywrightPage,
  selector: string,
): Promise<DomSnapshot | undefined> {
  return page.evaluate(
    ({ rootSelector, names }) => {
      const root = document.querySelector(rootSelector);

      if (!root) {
        return undefined;
      }

      const html = root.innerHTML;

      if (!html.trim()) {
        return undefined;
      }

      const attributes: Record<string, boolean> = {};

      for (const name of names) {
        attributes[name] = root.hasAttribute(name) || Boolean(root.querySelector(`[${name}]`));
      }

      return { html, attributes };
    },
    { rootSelector: selector, names: [...HTML_BOOLEAN_ATTRIBUTES] },
  );
}
