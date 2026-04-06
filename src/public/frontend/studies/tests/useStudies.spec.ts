// Tests for studies composable behavior.
import { describe, expect, it, vi } from 'vitest';
import { useStudies } from '../useStudies';

describe('useStudies', () => {
  it('stores queue payload after load', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        call += 1;
        if (call === 1) {
          return { ok: true, json: async () => ({ hasPrompt: false, pendingStudy: false }) };
        }

        return { ok: true, json: async () => [{ id: 1, prompt: 'tema', createdAt: '' }] };
      })
    );

    const { loadStatus, loadQueue, queue } = useStudies();
    await loadStatus();
    await loadQueue();

    expect(queue.value).toHaveLength(1);
  });
});
