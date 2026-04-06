// Shared date formatter composable used by feature-level presentation logic.
import type { DateFormatter } from './interfaces';

export const useDateFormatter = (): DateFormatter => {
  const safeParse = (value: string | null | undefined): Date | null => {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (value: string | null | undefined): string => {
    const date = safeParse(value);
    return date ? date.toLocaleDateString('pt-BR') : '-';
  };

  const formatDateTime = (value: string | null | undefined): string => {
    const date = safeParse(value);
    return date ? date.toLocaleString('pt-BR') : value || '-';
  };

  return {
    formatDate,
    formatDateTime,
  };
};
