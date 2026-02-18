import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayout } from '@/hooks/use-layout';

describe('useLayout', () => {
  it('syncs layout order from storage events', () => {
    const { result } = renderHook(() => useLayout(['a', 'b', 'c']));

    act(() => {
      window.localStorage.setItem('tn-layout-order', JSON.stringify(['c', 'a', 'b']));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'tn-layout-order',
          newValue: JSON.stringify(['c', 'a', 'b']),
        }),
      );
    });

    expect(result.current.orderedSessionIds).toEqual(['c', 'a', 'b']);
  });
});
