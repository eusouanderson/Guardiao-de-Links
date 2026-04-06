// Tests for date formatter composable behavior.
import { describe, expect, it } from 'vitest';
import { useDateFormatter } from '../useDateFormatter';

describe('useDateFormatter', () => {
  const { formatDate, formatDateTime } = useDateFormatter();

  it('returns fallback for invalid date', () => {
    expect(formatDate('invalid')).toBe('-');
  });

  it('returns formatted fallback for empty value', () => {
    expect(formatDateTime('')).toBe('-');
  });
});
