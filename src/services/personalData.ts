import type { StorageService } from './storageService';

/** Parent "delete everything on this phone": saved data first, then the recordings. */
export async function deletePersonalData(storage: StorageService, removeVoiceFiles?: () => Promise<void>): Promise<void> {
  await storage.clearPersonalData();
  try {
    await removeVoiceFiles?.();
  } catch {
    // recordings are already unlisted; a leftover file is not worth failing the deletion
  }
}
