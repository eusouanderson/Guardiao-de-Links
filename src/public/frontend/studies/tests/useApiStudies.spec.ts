// Tests for studies API composable behavior.
import { describe, expect, it, vi } from 'vitest';
import { useApiStudies } from '../useApiStudies';

describe('useApiStudies', () => {
  it('loads status payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ hasPrompt: true, pendingStudy: true }),
      })
    );

    const { fetchStatus } = useApiStudies();
    await expect(fetchStatus()).resolves.toMatchObject({ hasPrompt: true });
  });
});
