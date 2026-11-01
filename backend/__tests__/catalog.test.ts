import { afterEach, describe, expect, it } from 'vitest';

import { findPersonalStory } from '../../story-engine/personal';
import { ensureCatalog, resetCatalogCache } from '../catalog';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' };
const goodRow = {
  id: 'db-story',
  title: 'डीबी {नाव}',
  age_band: '6-7',
  category: 'magic',
  voices: { बाळ: 'OLDER_CHILD' },
  quote_speakers: ['बाळ'],
  template: 'सकाळ झाली होती. पक्षी गाणी गात होते. बागेत फुलं उमलली होती. आजी आणि {नाव} बागेत गेले. वारा हळूहळू वाहत होता. समोर एक मोठं झाड होतं. झाडावर एक इवलं घरटं होतं. घरट्यात दोन पिल्लं झोपली होती. आजीने हळूच बोट ओठांवर ठेवलं. सगळीकडे शांतता पसरली होती.\n\n\"चल, खेळू,\" {नाव+ने} म्हटलं.',
  published: true,
};
const ok = (rows: unknown) => (async () => new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;

afterEach(resetCatalogCache);

describe('server story catalogue', () => {
  it('registers published stories and keeps the built-in ones', async () => {
    await ensureCatalog(env, () => {}, ok([goodRow]));
    expect(findPersonalStory('db-story')?.title).toBe('डीबी {नाव}');
    expect(findPersonalStory('kajava-ani-hero')).toBeDefined();
  });

  it('ignores a bad row without failing', async () => {
    const lines: string[] = [];
    await ensureCatalog(env, (l) => lines.push(l), ok([{ ...goodRow, category: 'nope' }]));
    expect(findPersonalStory('db-story')).toBeUndefined();
    expect(lines.join(' ')).toContain('ignored');
  });

  it('uses the built-in stories when Supabase is down, and does not hammer it', async () => {
    let calls = 0;
    const down = (async () => {
      calls++;
      throw new Error('offline');
    }) as unknown as typeof fetch;
    let t = 1_000_000;
    await ensureCatalog(env, () => {}, down, () => t);
    await ensureCatalog(env, () => {}, down, () => t + 1000);
    expect(calls).toBe(1);
    expect(findPersonalStory('kajava-ani-hero')).toBeDefined();
    t += 60_000;
    await ensureCatalog(env, () => {}, down, () => t);
    expect(calls).toBe(2);
  });

  it('asks Supabase only once within the cache time', async () => {
    let calls = 0;
    const f = (async () => {
      calls++;
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    await ensureCatalog(env, () => {}, f);
    await ensureCatalog(env, () => {}, f);
    expect(calls).toBe(1);
  });

  it('does nothing without Supabase settings', async () => {
    await ensureCatalog({}, () => {}, ok([goodRow]));
    expect(findPersonalStory('db-story')).toBeUndefined();
  });
});
