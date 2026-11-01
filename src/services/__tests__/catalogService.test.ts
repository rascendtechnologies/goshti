import { afterEach, describe, expect, it } from 'vitest';

import { allPersonalStories, findPersonalStory, setCatalogStories } from '@engine/index';

import { CatalogService } from '../catalogService';

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: 'नवी {नाव}',
  age_band: '4-5',
  category: 'animals',
  voices: { बाळ: 'SMALL_CHILD' },
  quote_speakers: ['बाळ'],
  template: 'सकाळ झाली होती. पक्षी गाणी गात होते. बागेत फुलं उमलली होती. आजी आणि {नाव} बागेत गेले. वारा हळूहळू वाहत होता. समोर एक मोठं झाड होतं. झाडावर एक इवलं घरटं होतं. घरट्यात दोन पिल्लं झोपली होती. आजीने हळूच बोट ओठांवर ठेवलं. सगळीकडे शांतता पसरली होती.\n\n\"चल, खेळू,\" {नाव+ने} म्हटलं.',
  published: true,
  ...extra,
});
const memory = (initial: string | null = null) => {
  let v = initial;
  return { get: async () => v, set: async (x: string) => void (v = x), peek: () => v };
};
const reply = (rows: unknown) => (async () => new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;
const base = { supabaseUrl: 'https://x.supabase.co', anonKey: 'anon' };

afterEach(() => setCatalogStories([]));

describe('CatalogService', () => {
  it('fetches, uses and keeps the published stories', async () => {
    const cache = memory();
    const n = await new CatalogService({ ...base, cache, fetchImpl: reply([row('abc-one')]) }).refresh();
    expect(n).toBe(1);
    expect(findPersonalStory('abc-one')).toBeDefined();
    expect(cache.peek()).toContain('abc-one');
  });

  it('uses the saved copy straight away, before the network answers', async () => {
    const cache = memory(JSON.stringify([row('saved-one')]));
    const svc = new CatalogService({ ...base, cache, fetchImpl: reply([]) });
    await svc.ready();
    expect(findPersonalStory('saved-one')).toBeDefined();
  });

  it('keeps the built-in stories when offline or when the saved copy is damaged', async () => {
    const before = allPersonalStories().length;
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const svc = new CatalogService({ ...base, cache: memory('{not json'), fetchImpl: down });
    await svc.ready();
    expect(await svc.refresh()).toBeNull();
    expect(allPersonalStories()).toHaveLength(before);
  });

  it('ignores refused rows and does not ask again too soon', async () => {
    let calls = 0;
    const f = (async () => {
      calls++;
      return new Response(JSON.stringify([row('bad-one', { category: 'nope' })]), { status: 200 });
    }) as unknown as typeof fetch;
    const svc = new CatalogService({ ...base, cache: memory(), fetchImpl: f, now: () => 5_000_000 });
    expect(await svc.refresh()).toBe(0);
    expect(await svc.refresh()).toBeNull();
    expect(calls).toBe(1);
    expect(findPersonalStory('bad-one')).toBeUndefined();
  });

  it('does nothing without Supabase settings', async () => {
    expect(await new CatalogService({ supabaseUrl: '', anonKey: '', cache: memory() }).refresh()).toBeNull();
  });
});
