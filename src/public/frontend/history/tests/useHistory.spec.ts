// Tests for history composable behavior.
import { describe, expect, it, vi } from 'vitest';
import { useHistory } from '../useHistory';

describe('useHistory', () => {
  it('fills history and computes stats after successful load', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          promptSnapshot: 'javascript',
          explanation: 'x',
          cycleNumber: 1,
          totalQuestions: 10,
          correctCount: 10,
          completedAt: '2026-04-06T10:00:00.000Z',
        },
      ],
    });

    vi.stubGlobal('fetch', fetchMock);
    const { history, stats, loadHistory } = useHistory();
    await loadHistory();

    expect(history.value).toHaveLength(1);
    expect(stats.value.totalCycles).toBe(1);
    expect(stats.value.totalThemes).toBe(1);
  });

  it('sets error message on request failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Falha API' }),
    });

    vi.stubGlobal('fetch', fetchMock);
    const { errorMessage, loadHistory } = useHistory();
    await loadHistory();

    expect(errorMessage.value).toContain('Falha API');
  });
});
