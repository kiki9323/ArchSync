export interface AppProbe {
  url: string;
  reachable: boolean;
  error?: string;
}

export async function probeApp(url: string): Promise<AppProbe> {
  const baseUrl = url.replace(/\/$/, '');

  try {
    const response = await fetch(baseUrl, { redirect: 'follow' });

    return {
      url: baseUrl,
      reachable: response.ok,
      error: response.ok ? undefined : `App responded ${response.status}`,
    };
  } catch (error) {
    return {
      url: baseUrl,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
