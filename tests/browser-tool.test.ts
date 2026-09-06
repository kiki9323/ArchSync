import { describe, expect, it } from 'vitest';

import { observeSnapshot } from '../src/runtime/browser-tool.js';

describe('observeSnapshot', () => {
  it('expected attribute만 snapshot에서 읽는다', () => {
    expect(
      observeSnapshot({
        snapshot: {
          html: '<button disabled hidden>Claimed</button>',
          attributes: { disabled: true, hidden: true },
        },
        attribute: 'disabled',
      }),
    ).toEqual({
      status: 'observed',
      renderChanged: false,
      attributes: { disabled: true },
    });
  });

  it('snapshot이 없으면 skip이다', () => {
    expect(observeSnapshot({ snapshot: undefined, attribute: 'disabled' })).toEqual({
      status: 'skipped',
      reason: 'snapshot-unavailable',
    });
  });
});
