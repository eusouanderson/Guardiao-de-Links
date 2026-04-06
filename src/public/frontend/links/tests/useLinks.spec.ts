// Tests for links composable behavior.
import { describe, expect, it, vi } from 'vitest';
import { useLinks } from '../useLinks';

describe('useLinks', () => {
  it('filters links by query', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ name: 'Node', url: 'https://nodejs.org' }],
      })
    );

    const { loadLinks, searchTerm, filteredLinks } = useLinks();
    await loadLinks();

    searchTerm.value = 'node';
    expect(filteredLinks.value).toHaveLength(1);
  });
});
