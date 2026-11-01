import { afterEach, describe, expect, it } from 'vitest';

import { allPersonalStories, catalogRowToStory, findPersonalStory, parseCatalogRows, PERSONAL_STORIES, personalStoryId, pickPersonalStory, setCatalogStories } from '../personal';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'nava-prayog',
  title: 'नवी गोष्ट आणि {नाव}',
  age_band: '4-5',
  category: 'animals',
  positive_value: 'मदत',
  voices: { बाळ: 'SMALL_CHILD' },
  quote_speakers: ['बाळ'],
  ambience: 'BIRDS',
  template: 'सकाळ झाली होती. पक्षी गाणी गात होते. बागेत फुलं उमलली होती. आजी आणि {नाव} बागेत गेले. वारा हळूहळू वाहत होता. समोर एक मोठं झाड होतं. झाडावर एक इवलं घरटं होतं. घरट्यात दोन पिल्लं झोपली होती. आजीने हळूच बोट ओठांवर ठेवलं. सगळीकडे शांतता पसरली होती.\n\n\"चल, खेळू,\" {नाव+ने} म्हटलं.',
  published: true,
  ...over,
});

afterEach(() => setCatalogStories([]));

describe('story catalogue rows', () => {
  it('accepts a good row', () => {
    const r = catalogRowToStory(row());
    expect('story' in r && r.story.ageBand).toBe('4-5');
  });

  it.each([
    ['bad id', { id: 'Bad Id!' }],
    ['unknown category', { category: 'cars' }],
    ['bad age band', { age_band: '10-12' }],
    ['unknown voice', { voices: { बाळ: 'ROBOT' } }],
    ['unknown ambience', { ambience: 'LASER' }],
    ['speaker without a voice', { quote_speakers: ['मोर'] }],
    ['unknown placeholder ending', { template: 'आजी आणि {नाव+झझ} गेले. सकाळ झाली होती. पक्षी गाणी गात होते. बागेत फुलं उमलली होती. वारा हळूहळू वाहत होता.' }],
    ['missing template', { template: '' }],
  ])('refuses %s', (_name, over) => {
    expect('errors' in catalogRowToStory(row(over))).toBe(true);
  });

  it('uses only published, valid rows', () => {
    const refused: string[] = [];
    const out = parseCatalogRows([row(), row({ id: 'draft-one', published: false }), row({ id: 'broken-one', category: 'x' })], (id) => refused.push(id));
    expect(out.map((s) => s.id)).toEqual(['nava-prayog']);
    expect(refused).toEqual(['broken-one']);
    expect(parseCatalogRows('nope')).toEqual([]);
  });
});

describe('catalogue first, built-in stories as the fallback', () => {
  it('uses the built-in stories when the catalogue is empty', () => {
    expect(allPersonalStories()).toBe(PERSONAL_STORIES);
    expect(findPersonalStory('kajava-ani-hero')).toBeDefined();
  });

  it('puts catalogue stories first and lets a catalogue story replace a built-in one by id', () => {
    const [added] = parseCatalogRows([row()]);
    const [fixed] = parseCatalogRows([row({ id: 'kajava-ani-hero', title: 'दुरुस्त {नाव}' })]);
    setCatalogStories([added!, fixed!]);
    expect(findPersonalStory('nava-prayog')?.title).toContain('नवी');
    expect(findPersonalStory('kajava-ani-hero')?.title).toBe('दुरुस्त {नाव}');
    expect(allPersonalStories().filter((s) => s.id === 'kajava-ani-hero')).toHaveLength(1);
    expect(allPersonalStories()).toHaveLength(PERSONAL_STORIES.length + 1);
    const pick = pickPersonalStory({ age: 5, category: 'animals', child: { name: 'केतू', gender: 'BOY' }, heardIds: [] });
    expect(pick?.id).toBe('nava-prayog');
  });

  it('falls back to a built-in story once the catalogue one has been heard', () => {
    setCatalogStories(parseCatalogRows([row()]));
    const child = { name: 'केतू', gender: 'BOY' as const };
    const first = pickPersonalStory({ age: 5, category: 'animals', child, heardIds: [] })!;
    expect(first.id).toBe('nava-prayog');
    const next = pickPersonalStory({ age: 5, category: 'animals', child, heardIds: [personalStoryId(first, child)] });
    expect(next?.id).toBe('hatti-ani-hero');
  });
});
