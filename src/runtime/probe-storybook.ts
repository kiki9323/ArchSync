export interface StorybookProbe {
  url: string;
  reachable: boolean;
  storyCount?: number;
  error?: string;
}

export async function probeStorybook(url: string): Promise<StorybookProbe> {
  const baseUrl = url.replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/index.json`);

    if (!response.ok) {
      return {
        url: baseUrl,
        reachable: false,
        error: `Storybook responded ${response.status}`,
      };
    }

    const index = (await response.json()) as { entries?: object; stories?: object };
    const entries = index.entries ?? index.stories ?? {};

    return {
      url: baseUrl,
      reachable: true,
      storyCount: Object.keys(entries).length,
    };
  } catch (error) {
    return {
      url: baseUrl,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
