import type { DomSnapshot } from './browser-tool.js';

export interface StorybookStory {
  id: string;
  title: string;
  name: string;
}

export interface StorybookSession {
  listStories(): Promise<StorybookStory[]>;
  openStory(input: {
    storyId: string;
    args?: Record<string, string>;
  }): Promise<DomSnapshot | undefined>;
}
