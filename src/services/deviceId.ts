import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'goshti.deviceId.v1';
let cached: string | null = null;

function randomId(): string {
  const part = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${part()}${part()}${part()}${part()}`;
}

/**
 * A random id for this install. Sent with story/voice requests only so the server can stop one
 * phone from using up the daily allowance (stored there hashed). It says nothing about the child
 * and is not removed by "delete everything" (so deleting data is not a way around the limit).
 */
export async function getDeviceId(): Promise<string | undefined> {
  if (cached) return cached;
  try {
    let id = await AsyncStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      await AsyncStorage.setItem(KEY, id);
    }
    cached = id;
    return id;
  } catch {
    return undefined;
  }
}
