/** React prop name → HTML boolean attribute. 이름이 항상 같지는 않다. */
const REACT_TO_HTML_BOOLEAN_ATTRIBUTE: Record<string, string> = {
  disabled: 'disabled',
  hidden: 'hidden',
  checked: 'checked',
  required: 'required',
  readOnly: 'readonly',
};

export const HTML_BOOLEAN_ATTRIBUTES = [
  'disabled',
  'hidden',
  'checked',
  'required',
  'readonly',
] as const;

export type HtmlBooleanAttribute = (typeof HTML_BOOLEAN_ATTRIBUTES)[number];

export function toHtmlBooleanAttribute(reactProp: string): string | undefined {
  return REACT_TO_HTML_BOOLEAN_ATTRIBUTE[reactProp];
}
