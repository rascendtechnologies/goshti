import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoryRequest } from '@engine/index';

import { BackendStoryGenerator } from '../storyGenerator';

vi.mock('../deviceId', () => ({ getDeviceId: async () => 'device-1234567890abcdef' }));

const request = { age: 6, category: 'magic', mode: 'CUSTOM', userIdea: 'x' } as unknown as StoryRequest;
const approved = {
  status: 'APPROVED',
  story: { title: 'T', storyText: 'S', audioScript: { segments: [{ type: 'NARRATION', text: 'a' }] } },
};

afterEach(() => vi.unstubAllGlobals());

describe('story steps survive a dropped connection', () => {
  it('asks the same step again when the connection drops', async () => {
    const payloads: string[] = [];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        payloads.push(init.body);
        call++;
        if (call === 1) return new Response(JSON.stringify({ status: 'IN_PROGRESS', continuation: 'c1' }));
        if (call === 2) throw new TypeError('Network request failed');
        return new Response(JSON.stringify(approved));
      }),
    );
    const gen = new BackendStoryGenerator('https://x/fn', {}, 10_000, 1000, 1);
    const result = await gen.generate(request);
    expect(result.status).toBe('APPROVED');
    expect(JSON.parse(payloads[1]).continuation).toBe('c1');
    expect(JSON.parse(payloads[2]).continuation).toBe('c1'); // same step, asked again
  });

  it('gives up after three tries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network request failed'); }));
    const gen = new BackendStoryGenerator('https://x/fn', {}, 10_000, 1000, 1);
    const result = await gen.generate(request);
    expect(result.status).toBe('FAILED');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('asks again when a step hangs', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: { signal: AbortSignal }) => {
        call++;
        if (call === 1) return new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))));
        return Promise.resolve(new Response(JSON.stringify(approved)));
      }),
    );
    const gen = new BackendStoryGenerator('https://x/fn', {}, 10_000, 50, 1);
    expect((await gen.generate(request)).status).toBe('APPROVED');
    expect(call).toBe(2);
  });
});
