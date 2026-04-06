// Tests for links API composable behavior.
import { describe, expect, it, vi } from 'vitest';
import { useApiLinks } from '../useApiLinks';

describe('useApiLinks', () => {
  it('fetches links list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const { fetchLinks } = useApiLinks();
    await expect(fetchLinks()).resolves.toEqual([]);
  });
});
