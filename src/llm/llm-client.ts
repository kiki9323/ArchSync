export interface GenerateStructuredOptions<T> {
  prompt: string;
  parse: (value: unknown) => T;
}

export interface LlmClient {
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T>;
}
