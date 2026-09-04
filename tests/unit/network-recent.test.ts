import { describe, expect, it } from 'vitest';
import { networkMethods } from '../../src/daemon/methods/network.js';

describe('network.recent', () => {
  it('fails with NOT_IMPLEMENTED instead of reporting ok:true + empty data', async () => {
    // Regression: the stub used to resolve with { requests: [], note } which
    // reads as "no requests were made" to agents; README lists the method as
    // reserved, so an unimplemented feature must surface NOT_IMPLEMENTED.
    await expect(
      (networkMethods['network.recent'] as (...a: unknown[]) => Promise<unknown>)({}, {}),
    ).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
