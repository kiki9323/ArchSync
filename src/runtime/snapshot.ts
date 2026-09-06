function normalize(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

export function domSnapshotChanged(baseline: string, activated: string): boolean {
  return normalize(baseline) !== normalize(activated);
}
