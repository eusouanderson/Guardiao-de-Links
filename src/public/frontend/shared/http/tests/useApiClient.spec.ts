// Tests for shared API client composable behavior.
import { describe, expect, it, vi } from 'vitest';
import { useApiClient } from '../useApiClient';

describe('useApiClient', () => {
  it('returns parsed payload when request succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    vi.stubGlobal('fetch', fetchMock);
    const { requestJson } = useApiClient();

    await expect(requestJson('/ok')).resolves.toEqual({ ok: true });
  });

  it('throws API error message when request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Erro controlado' }),
    });

    vi.stubGlobal('fetch', fetchMock);
    const { requestJson } = useApiClient();

    await expect(requestJson('/fail')).rejects.toThrow('Erro controlado');
  });
});
