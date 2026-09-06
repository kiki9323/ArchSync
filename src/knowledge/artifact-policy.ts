/**
 * ArchSync artifact lifetime.
 *
 * CODE is the original source of truth.
 * Knowledge JSON is the only machine-readable SSOT for consumers.
 * RAW is regenerable evidence for extractor/transformer debugging.
 * Markdown is a derived human view and is never a source of truth.
 * Sync manifest is generated metadata for incremental sync.
 */
export const knowledgeArtifactPolicy = {
  code: 'original-source',
  knowledgeJson: 'persistent-ssot',
  rawEvidence: 'cache',
  markdownDocs: 'on-demand',
  syncManifest: 'generated-metadata',
  syncResult: 'ephemeral',
  report: 'ephemeral',
  runtimeObservation: 'ephemeral',
  validationResult: 'ephemeral',
} as const;

export const knowledgeJsonDirectory = ['.knowledge', 'components'] as const;
export const rawEvidenceDirectory = ['.knowledge', 'raw', 'components'] as const;
export const syncManifestPath = ['.knowledge', 'manifest.json'] as const;
