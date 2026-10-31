import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackendVoiceClient, bytesToBase64 } from '../voiceService';

const BASE = 'https://x.supabase.co/storage/v1/object/public/library-voice';

function wav(seconds = 1): Uint8Array {
  const n = 44 + Math.floor(48000 * seconds);
  const b = new Uint8Array(n);
  b.set([0x52, 0x49, 0x46, 0x46], 0);
  b.set([0x57, 0x41, 0x56, 0x45], 8);
  return b;
}

function stubFetch(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const hit = Object.entries(routes).find(([k]) => url.includes(k));
      return hit ? hit[1]() : new Response('no', { status: 404 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('library voice made once', () => {
  const manifest = { chunks: [{ file: 'part-0.wav', pauseAfterMs: 300 }, { file: 'part-1.wav', pauseAfterMs: 0 }] };

  it('uses the stored voice (no AI request) when it is there, young or older', async () => {
    const calls = stubFetch({
      '/manifest.json': () => new Response(JSON.stringify(manifest)),
      'part-0.wav': () => new Response(wav() as BodyInit),
    });
    const client = new BackendVoiceClient('https://x.supabase.co/functions/v1/generate-story', {}, 1000, BASE);
    const ticket = await client.libraryTicket('manus-lal-chendu', 4);
    expect(ticket).toEqual({ token: 'pre:manus-lal-chendu:young', totalChunks: 2 });
    expect(calls[0]).toBe(`${BASE}/manus-lal-chendu/young/manifest.json`);
    const part = await client.renderChunk(ticket!.token, 0);
    expect(part.pauseAfterMs).toBe(300);
    expect(part.base64.startsWith('UklGR')).toBe(true); // "RIFF"
    expect(calls.some((c) => c.includes('generate-story'))).toBe(false);
    expect((await client.libraryTicket('manus-lal-chendu', 7))?.token).toBe('pre:manus-lal-chendu:older');
  });

  it('falls back to making the voice on demand when nothing is stored', async () => {
    const calls = stubFetch({
      generate_never: () => new Response('{}'),
      generate: () => new Response(JSON.stringify({ ttsAvailable: true, audioToken: 'tok', audioChunks: 5 })),
    });
    const client = new BackendVoiceClient('https://x.supabase.co/functions/v1/generate', {}, 1000, BASE);
    expect(await client.libraryTicket('abc', 5)).toEqual({ token: 'tok', totalChunks: 5 });
    expect(calls[0]).toContain('/abc/young/manifest.json');
    expect(calls[1]).toContain('/functions/v1/generate');
  });

  it('does not look online at all when no storage address is set', async () => {
    const calls = stubFetch({ generate: () => new Response(JSON.stringify({ ttsAvailable: true, audioToken: 't', audioChunks: 3 })) });
    const client = new BackendVoiceClient('https://x.supabase.co/functions/v1/generate', {});
    await client.libraryTicket('abc', 8);
    expect(calls).toHaveLength(1);
  });
});

describe('bytesToBase64', () => {
  it('encodes large arrays', () => {
    const big = new Uint8Array(100_000).fill(65);
    expect(atob(bytesToBase64(big)).length).toBe(100_000);
  });
});
