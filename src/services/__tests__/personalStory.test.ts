import { afterEach, describe, expect, it, vi } from 'vitest';

import { findPersonalStory, personalParts } from '@engine/index';
import type { ChildProfile, GoshtiStory, Subscription } from '@/types/models';

import { ChildProfileService, personalChildOf } from '../childProfileService';
import type { StorageService } from '../storageService';
import type { GenerationResult, StoryGenerator } from '../storyGenerator';
import { DefaultStoryService } from '../storyService';
import { LocalSubscriptionService } from '../subscriptionService';
import { MockTtsService } from '../ttsService';
import { BackendVoiceClient } from '../voiceService';

function memoryStorage(profile: ChildProfile | null): StorageService {
  let p = profile;
  let stories: GoshtiStory[] = [];
  let favs: string[] = [];
  let sub: Subscription | null = null;
  let month: string | null = null;
  let voice = {};
  return {
    getChildProfile: async () => p,
    saveChildProfile: async (x) => void (p = x),
    getStories: async () => stories,
    saveStory: async (s) => void (stories = [s, ...stories.filter((x) => x.id !== s.id)]),
    saveStories: async (s) => void (stories = s),
    getFavouriteIds: async () => favs,
    saveFavouriteIds: async (f) => void (favs = f),
    getSubscription: async () => sub,
    saveSubscription: async (s) => void (sub = s),
    getUsageMonth: async () => month,
    saveUsageMonth: async (m) => void (month = m),
    getPreparedStories: async () => ({}),
    savePreparedStories: async () => {},
    getVoiceStates: async () => voice,
    saveVoiceStates: async (v) => void (voice = v),
  };
}

class NeverGenerator implements StoryGenerator {
  readonly kind = 'backend' as const;
  calls = 0;
  async generate(): Promise<GenerationResult> {
    this.calls++;
    return { status: 'FAILED', reason: 'should not be called' };
  }
}

function setup(profile: ChildProfile | null) {
  const storage = memoryStorage(profile);
  const generator = new NeverGenerator();
  const subscription = new LocalSubscriptionService(storage);
  const tickets: string[] = [];
  const service = new DefaultStoryService({
    generator,
    seedGenerator: generator,
    tts: new MockTtsService(),
    storage,
    subscription,
    personalVoiceTicket: (id, child, age) => {
      tickets.push(`${id}:${child.name}:${child.gender}:${age}`);
      return { token: 'per:x', totalChunks: 3 };
    },
    minimumLatencyMs: 0,
  });
  return { storage, generator, subscription, service, tickets };
}

describe('personal stories for "Aaji chooses"', () => {
  it('plays a personal story with the child’s name, without any AI story call', async () => {
    const { service, generator, subscription, tickets } = setup({ id: 'c', name: 'केतू', age: 5, gender: 'BOY' });
    const out = await service.createStory({ age: 5, category: 'animals', mode: 'RANDOM' });
    expect(out.status).toBe('CREATED');
    if (out.status !== 'CREATED') return;
    expect(out.story.storyText).toContain('केतू');
    expect(out.story.storyText).not.toContain('{');
    expect(generator.calls).toBe(0);
    expect(tickets).toEqual(['hatti-ani-hero:केतू:BOY:5']);
    expect((await subscription.getSubscription()).storiesGeneratedThisMonth).toBe(1);
  });

  it('does not repeat a personal story, and a second child still gets it', async () => {
    const { service, storage } = setup({ id: 'c', name: 'सई', age: 5, gender: 'GIRL' });
    const first = await service.createStory({ age: 5, category: 'animals', mode: 'RANDOM' });
    expect(first.status).toBe('CREATED');
    // only one animals story exists for this age → the AI path runs (and falls back to the library)
    const again = await service.createStory({ age: 5, category: 'animals', mode: 'RANDOM' });
    expect(again.status === 'CREATED' && again.story.id.startsWith('per-')).toBe(false);
    await storage.saveChildProfile({ id: 'c', name: 'राम', age: 5, gender: 'BOY' });
    const other = await service.createStory({ age: 5, category: 'animals', mode: 'RANDOM' });
    expect(other.status).toBe('CREATED');
  });

  it('uses the AI path when the name is not in Marathi letters or the age has no personal story', async () => {
    const english = setup({ id: 'c', name: 'Ketu', age: 5, gender: 'BOY' });
    await english.service.createStory({ age: 5, category: 'animals', mode: 'RANDOM' }).catch(() => {});
    expect(english.generator.calls).toBeGreaterThan(0);

    const older = setup({ id: 'c', name: 'केतू', age: 8, gender: 'BOY' });
    await older.service.createStory({ age: 8, category: 'bedtime', mode: 'RANDOM' }).catch(() => {});
    expect(older.generator.calls).toBeGreaterThan(0);
  });

  it('never uses a personal story for a child’s own idea', async () => {
    const { service, generator } = setup({ id: 'c', name: 'केतू', age: 5, gender: 'BOY' });
    await service.createStory({ age: 5, category: 'animals', mode: 'CUSTOM', userIdea: 'एक मांजर' }).catch(() => {});
    expect(generator.calls).toBeGreaterThan(0);
  });
});

describe('Marathi name for personal stories', () => {
  it('uses the Marathi name when the typed name is English, and keeps it while the name stays', async () => {
    const storage = memoryStorage(null);
    const svc = new ChildProfileService(storage);
    const saved = await svc.saveProfile({ name: 'Ketu', age: 5, gender: 'BOY', nameMarathi: 'केतू' });
    expect(personalChildOf(saved)).toEqual({ name: 'केतू', gender: 'BOY' });
    const aged = await svc.saveProfile({ name: 'Ketu', age: 6, gender: 'BOY' });
    expect(personalChildOf(aged)?.name).toBe('केतू');
    const renamed = await svc.saveProfile({ name: 'Rohan', age: 6, gender: 'BOY' });
    expect(personalChildOf(renamed)).toBeNull();
  });
});

describe('personal story voice on the phone', () => {
  afterEach(() => vi.unstubAllGlobals());
  const BASE = 'https://x.supabase.co/storage/v1/object/public/library-voice';
  const story = findPersonalStory('hatti-ani-hero')!;
  const child = { name: 'केतू', gender: 'BOY' as const };
  const parts = personalParts(story, child, 5);

  function stub() {
    const urls: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { body?: string }) => {
        urls.push(url);
        if (url.includes('/storage/')) return url.includes('shared-') && !url.includes('-0-') ? new Response(new Uint8Array(100)) : new Response('no', { status: 404 });
        bodies.push(JSON.parse(init?.body ?? '{}'));
        return new Response(JSON.stringify({ base64: 'UklGRg==', pauseAfterMs: 100 }));
      }),
    );
    return { urls, bodies };
  }

  it('hands out a ticket with one chunk per part', () => {
    const client = new BackendVoiceClient('https://x/fn', {}, 1000, BASE);
    const ticket = client.personalTicket(story.id, child, 5)!;
    expect(ticket.totalChunks).toBe(parts.length);
    expect(ticket.token).toBe('per:hatti-ani-hero:5:BOY:केतू');
  });

  it('downloads shared parts and asks the server only for the parts with the name', async () => {
    const { urls, bodies } = stub();
    const client = new BackendVoiceClient('https://x/fn', {}, 1000, BASE);
    const { token } = client.personalTicket(story.id, child, 5)!;
    const shared = parts.findIndex((p) => !p.personal && p.index > 0);
    const personal = parts.findIndex((p) => p.personal);
    await client.renderChunk(token, shared);
    expect(urls[0]).toBe(`${BASE}/personal/${story.id}/young/shared-${shared}-${parts[shared].hash}.wav`);
    expect(bodies).toHaveLength(0);
    await client.renderChunk(token, personal);
    expect(bodies[0]).toMatchObject({ action: 'personal-render', id: story.id, part: personal, name: 'केतू', gender: 'BOY', hash: parts[personal].hash });
  });

  it('makes a shared part on the server (without the name) when it is not stored yet', async () => {
    const { bodies } = stub();
    const client = new BackendVoiceClient('https://x/fn', {}, 1000, BASE);
    const { token } = client.personalTicket(story.id, child, 5)!;
    const first = parts.findIndex((p) => !p.personal);
    expect(first).toBe(0);
    await client.renderChunk(token, 0); // stub answers 404 for part 0
    expect(bodies[0]).toMatchObject({ action: 'personal-render', part: 0 });
    expect(bodies[0]).not.toHaveProperty('name');
  });
});
