import { describe, expect, it } from 'vitest';

import { toHtmlBooleanAttribute } from '../src/runtime/html-boolean-attributes.js';

describe('toHtmlBooleanAttribute', () => {
  it('maps React prop names to HTML boolean attributes', () => {
    expect(toHtmlBooleanAttribute('disabled')).toBe('disabled');
    expect(toHtmlBooleanAttribute('readOnly')).toBe('readonly');
    expect(toHtmlBooleanAttribute('isLoading')).toBeUndefined();
    expect(toHtmlBooleanAttribute('fullWidth')).toBeUndefined();
    expect(toHtmlBooleanAttribute('readonly')).toBeUndefined();
  });
});
