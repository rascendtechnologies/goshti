import { describe, expect, it, vi } from 'vitest';

import { deletePersonalData } from '../personalData';
import type { StorageService } from '../storageService';

describe('deletePersonalData', () => {
  it('clears saved data, then the recordings', async () => {
    const order: string[] = [];
    const storage = { clearPersonalData: vi.fn(async () => void order.push('data')) } as unknown as StorageService;
    await deletePersonalData(storage, async () => void order.push('files'));
    expect(order).toEqual(['data', 'files']);
  });

  it('still succeeds when the recordings cannot be removed', async () => {
    const storage = { clearPersonalData: vi.fn(async () => {}) } as unknown as StorageService;
    await expect(
      deletePersonalData(storage, async () => {
        throw new Error('disk');
      }),
    ).resolves.toBeUndefined();
  });
});
