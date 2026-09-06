import { activationValue } from './activate-prop.js';
import { observeSnapshot, type BrowserObserver } from './browser-tool.js';
import type { StorybookSession, StorybookStory } from './storybook-session.js';

export function createStorybookObserver(session: StorybookSession): BrowserObserver {
  return {
    harness: 'storybook',
    async observe(input) {
      const stories = await session.listStories();
      const story = findComponentStory(stories, input.component);

      if (!story) {
        return { status: 'skipped', reason: 'no-story' };
      }

      const activatedValue = activationValue(input.propType);

      if (activatedValue === undefined) {
        return { status: 'skipped', reason: 'cannot-activate-prop' };
      }

      const baseline = await session.openStory({ storyId: story.id });
      const snapshot = await session.openStory({
        storyId: story.id,
        args: { [input.prop]: activatedValue },
      });

      if (!baseline || !snapshot) {
        return { status: 'skipped', reason: 'snapshot-unavailable' };
      }

      return observeSnapshot({
        snapshot,
        baseline,
        attribute: input.attribute,
      });
    },
  };
}

function findComponentStory(stories: StorybookStory[], component: string): StorybookStory | undefined {
  const matched = stories.filter(
    (story) => story.title.includes(component) || story.name.includes(component),
  );

  if (matched.length === 0) {
    return undefined;
  }

  return matched.find((story) => /default/i.test(story.name)) ?? matched[0];
}
