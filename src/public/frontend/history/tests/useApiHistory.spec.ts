// Tests for history API composable behavior.
import { describe, expect, it, vi } from 'vitest';
import { useApiHistory } from '../useApiHistory';

describe('useApiHistory', () => {
  it('returns history list from endpoint payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, promptSnapshot: 'tema', cycleNumber: 1 }],
    });

    vi.stubGlobal('fetch', fetchMock);
    const { fetchStudyHistory } = useApiHistory();

    await expect(fetchStudyHistory()).resolves.toHaveLength(1);
  });
});
