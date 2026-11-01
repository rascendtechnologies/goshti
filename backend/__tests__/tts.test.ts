import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pcmToWav } from '../../story-engine/providers/geminiTts';
import { handleGenerateStory } from '../handler';

const quiet = { logger: { log() {} } };
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

/** A tiny WAV whose header says 100 Hz — about 40 s, a believable length for a story part. */
const believableWav = () => btoa(String.fromCharCode(...pcmToWav(new Uint8Array(8000), 100)));

describe('personal story voice', () => {
  const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'x', TTS_CHECK: 'off' };

  it('lists the parts and which of them are shared, with no key needed', async () => {
    const r = await handleGenerateStory({ action: 'personal-plan', id: 'kajava-ani-hero', age: 4 }, {}, quiet);
    expect(r.status).toBe(200);
    const parts = r.body.parts as { personal: boolean; hash: string }[];
    expect(parts.length).toBeGreaterThan(5);
    expect(parts.some((p) => p.personal)).toBe(true);
    expect(parts.some((p) => !p.personal)).toBe(true);
  });

  it('knows only its own stories, and only plain Devanagari names', async () => {
    expect((await handleGenerateStory({ action: 'personal-plan', id: 'say-anything' }, {}, quiet)).status).toBe(404);
    const personalIndex = ((await handleGenerateStory({ action: 'personal-plan', id: 'kajava-ani-hero', age: 4 }, {}, quiet)).body.parts as { personal: boolean }[]).findIndex((p) => p.personal);
    for (const name of ['Ketu', 'केतू. आणि पुढचं वाक्य', '', undefined]) {
      const r = await handleGenerateStory({ action: 'personal-render', id: 'kajava-ani-hero', age: 4, part: personalIndex, name, gender: 'BOY' }, env, quiet);
      expect(r.status).toBe(400);
    }
    const noGender = await handleGenerateStory({ action: 'personal-render', id: 'kajava-ani-hero', age: 4, part: personalIndex, name: 'केतू' }, env, quiet);
    expect(noGender.status).toBe(400);
  });

  it('renders a shared part without a name and a personal part with one', async () => {
    // A few seconds of audio — believable for a single short line (the length check still applies).
    const wav = btoa(String.fromCharCode(...pcmToWav(new Uint8Array(24000), 3000)));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ steps: [{ content: [{ type: 'audio', data: wav, mime_type: 'audio/wav' }] }] }))));
    const plan = (await handleGenerateStory({ action: 'personal-plan', id: 'kajava-ani-hero', age: 4 }, {}, quiet)).body.parts as { personal: boolean }[];
    const shared = await handleGenerateStory({ action: 'personal-render', id: 'kajava-ani-hero', age: 4, part: plan.findIndex((p) => !p.personal) }, env, quiet);
    expect(shared.status).toBe(200);
    expect(shared.body.personal).toBe(false);
    const own = await handleGenerateStory({ action: 'personal-render', id: 'kajava-ani-hero', age: 4, part: plan.findIndex((p) => p.personal), name: 'केतू', gender: 'BOY' }, env, quiet);
    expect(own.status).toBe(200);
    expect(own.body.personal).toBe(true);
    expect(String(own.body.base64).startsWith('UklGR')).toBe(true);
  });
});

describe('backend text-to-speech', () => {
  it('approved stories come with an audio token and chunk count', async () => {
    const r = await handleGenerateStory({ request: { age: 4, category: 'magic', mode: 'RANDOM' } }, {}, quiet);
    expect(r.body.status).toBe('APPROVED');
    expect(typeof r.body.audioToken).toBe('string');
    expect(r.body.audioChunks).toBeGreaterThan(0);
  });

  it('renders a chunk only for a server-issued token', async () => {
    const env = { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'x', TTS_CHECK: 'off' };
    // Story approved with the mock path would need no key; issue a token the way the handler does.
    const approved = await handleGenerateStory({ request: { age: 4, category: 'magic', mode: 'RANDOM' } }, {}, quiet);
    // token from a key-less backend is NOT valid for a keyed backend (different secret)
    const forged = await handleGenerateStory({ action: 'tts-render', audioToken: approved.body.audioToken, chunk: 0 }, env, quiet);
    expect(forged.status).toBe(400);

    const wav = believableWav();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ steps: [{ content: [{ type: 'audio', data: wav, mime_type: 'audio/wav' }] }] }))));
    const { issueAudioToken } = await import('../tts');
    const story = approved.body.story as { title: string; audioScript: never };
    const { audioToken } = await issueAudioToken(story.title, story.audioScript, env);
    const ok = await handleGenerateStory({ action: 'tts-render', audioToken, chunk: 0 }, env, quiet);
    expect(ok.status).toBe(200);
    expect(String(ok.body.base64).startsWith('UklGR')).toBe(true);
    expect(ok.body.totalChunks).toBeGreaterThan(0);

    const bad = await handleGenerateStory({ action: 'tts-render', audioToken, chunk: 99 }, env, quiet);
    expect(bad.status).toBe(400);
  });

  it('audition needs the key and ignores any text from the client', async () => {
    expect((await handleGenerateStory({ action: 'tts-audition', voice: 'Sulafat' }, {}, quiet)).status).toBe(503);
    const calls: string[] = [];
    const wav = believableWav();
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      calls.push(String(init.body));
      return new Response(JSON.stringify({ steps: [{ content: [{ type: 'audio', data: wav }] }] }));
    }));
    const r = await handleGenerateStory({ action: 'tts-audition', voice: 'Gacrux', text: 'say something rude' }, { GEMINI_API_KEY: 'k', TTS_CHECK: 'off' }, quiet);
    expect(r.status).toBe(200);
    expect(calls[0]).not.toContain('say something rude');
    expect(calls[0]).toContain('"voice":"Gacrux"');
  });
});

describe('library voice', () => {
  it('issues an audio token for a known library story id only', async () => {
    const env = { GEMINI_API_KEY: 'k' };
    const ok = await handleGenerateStory({ action: 'library-voice', id: 'manu-red-ball', age: 2 }, env, quiet);
    expect(ok.status).toBe(200);
    expect(typeof ok.body.audioToken).toBe('string');
    expect(ok.body.audioChunks).toBeGreaterThan(0);
    const bad = await handleGenerateStory({ action: 'library-voice', id: 'make-aaji-say-this', age: 2 }, env, quiet);
    expect(bad.status).toBe(404);
  });
});
